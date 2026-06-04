import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// db.js reads DATA_DIR at import time, so point it at a throwaway dir BEFORE
// the app (and its SQLite singleton) are imported.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-dash-routes-'));
process.env.DATA_DIR = tmpDir;
process.env.DEFAULT_INACTIVITY_DAYS = '7';
process.env.SYNC_ON_STARTUP = 'false';
process.env.SYNC_AUTO = 'false';
process.env.GITHUB_TOKEN = 'test-token';

// Keep GitHub offline and deterministic. refreshRepos() resolves to this list.
vi.mock('./github.js', () => ({
  rateLimit: {
    limit: 5000, remaining: 4999, used: 1, reset: null, lastChecked: null, authInvalid: false,
  },
  sourceStatus: { owners: [], warnings: [] },
  authStatus: { source: 'env', present: true },
  fetchAllRepos: vi.fn(),
  parseRateLimitHeaders: vi.fn(),
  parseOwners: (raw) => (raw ? String(raw).split(/[\s,]+/).filter(Boolean) : []),
}));

const { fetchAllRepos } = await import('./github.js');
const { app, refreshRepos } = await import('./index.js');

const REPO = { id: 101, full_name: 'me/alpha', name: 'alpha', language: 'JavaScript' };

beforeAll(async () => {
  fetchAllRepos.mockResolvedValue([REPO]);
  await refreshRepos(); // seeds repoCache + creates the repo_state row
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/repos', () => {
  it('returns the expected metadata keys and the seeded repo', async () => {
    const res = await request(app).get('/api/repos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      repos: expect.any(Array),
      cacheReady: true,
      defaultInactivityDays: 7,
      tokenPresent: true,
      rateLimit: expect.any(Object),
    }));
    expect(res.body).toHaveProperty('lastFetch');
    expect(res.body).toHaveProperty('syncing');
    expect(res.body.repos.find((r) => r.id === REPO.id)).toBeTruthy();
  });
});

describe('GET /api/health', () => {
  it('reports a healthy, ready process', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      status: 'ok',
      cacheReady: true,
      repoCount: expect.any(Number),
      uptimeSeconds: expect.any(Number),
    }));
  });
});

describe('POST /api/repos/:id/check', () => {
  it('rejects negative daysAgo with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-negative/);
  });

  it('rejects non-finite daysAgo with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 'soon' });
    expect(res.status).toBe(400);
  });

  it('accepts daysAgo: 0 and lands the repo in the furthest future column', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 0 });
    expect(res.status).toBe(200);
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.column).toBe('day-6'); // checked now, default 7 -> max offset 6
  });

  it('accepts daysAgo >= threshold and returns the repo to Today', async () => {
    await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 7 });
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.column).toBe('day-0');
  });
});

describe('checked_at reflects the real review time, not the scheduling anchor', () => {
  beforeAll(async () => {
    // Ensure the default 7-day interval so daysAgo maps to the expected column.
    await request(app).post(`/api/repos/${REPO.id}/inactivity`).send({ days: null });
  });

  it('stamps "checked today" when a card is dropped into a future column', async () => {
    // Dropping in "tomorrow" back-dates the anchor 6 days, but the review is now.
    await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 6 });
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.column).toBe('day-1');
    expect(repo.checkedAgeDays).toBe(0); // not "6d ago"
  });

  it('does not fabricate a check when moving an untouched repo to Today', async () => {
    await request(app).post(`/api/repos/${REPO.id}/clear`);
    await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 7 });
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.column).toBe('day-0');
    expect(repo.checkedAgeDays).toBeNull();
  });
});

describe('POST /api/repos/:id/inactivity', () => {
  it('rejects a negative override with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/inactivity`).send({ days: -3 });
    expect(res.status).toBe(400);
  });

  it('rejects a non-finite override with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/inactivity`).send({ days: 'lots' });
    expect(res.status).toBe(400);
  });

  it('accepts null (reset to default)', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/inactivity`).send({ days: null });
    expect(res.status).toBe(200);
  });

  it('accepts a valid number and persists the override', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/inactivity`).send({ days: 14 });
    expect(res.status).toBe(200);
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.effective_inactivity_days).toBe(14);
  });
});

describe('POST /api/repos/:id/priority', () => {
  it('rejects a priority outside 1|2|3|null with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/priority`).send({ priority: 5 });
    expect(res.status).toBe(400);
  });

  it('accepts a valid priority', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/priority`).send({ priority: 1 });
    expect(res.status).toBe(200);
  });

  it('accepts null (clear)', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/priority`).send({ priority: null });
    expect(res.status).toBe(200);
  });

  it('persists the priority on the board payload and survives a check', async () => {
    await request(app).post(`/api/repos/${REPO.id}/priority`).send({ priority: 2 });
    await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 3 });
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    // Scheduling a check must not clobber the user-assigned triage priority.
    expect(repo.priority).toBe(2);
  });
});

describe('POST /api/repos/:id/clear', () => {
  it('resets the schedule but keeps the triage priority', async () => {
    await request(app).post(`/api/repos/${REPO.id}/priority`).send({ priority: 1 });
    await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 3 });
    const res = await request(app).post(`/api/repos/${REPO.id}/clear`);
    expect(res.status).toBe(200);
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.column).toBe('day-0');
    expect(repo.checkedAgeDays).toBeNull();
    expect(repo.priority).toBe(1);
  });
});

describe('POST /api/repos/:id/touch', () => {
  it('resets the check timestamp and returns ok', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/touch`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('POST /api/reorder', () => {
  it('persists ordered ids', async () => {
    const res = await request(app).post('/api/reorder').send({ orderedIds: [REPO.id] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('tolerates a missing / non-array orderedIds', async () => {
    const res = await request(app).post('/api/reorder').send({});
    expect(res.status).toBe(200);
  });
});

describe('POST /api/repos/:id/ignore', () => {
  it('rejects a non-boolean ignored value with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/ignore`).send({ ignored: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/boolean/);
  });

  it('persists the ignore flag and surfaces it in the payload', async () => {
    await request(app).post(`/api/repos/${REPO.id}/ignore`).send({ ignored: true });
    let board = await request(app).get('/api/repos');
    expect(board.body.repos.find((r) => r.id === REPO.id).ignored).toBe(true);

    await request(app).post(`/api/repos/${REPO.id}/ignore`).send({ ignored: false });
    board = await request(app).get('/api/repos');
    expect(board.body.repos.find((r) => r.id === REPO.id).ignored).toBe(false);
  });
});

describe('notices', () => {
  it('rejects an empty notice body with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/notices`).send({ body: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty/);
  });

  it('adds notices, surfaces latest + count on the board, and lists them newest-first', async () => {
    await request(app).post(`/api/repos/${REPO.id}/notices`).send({ body: 'first note' });
    await request(app).post(`/api/repos/${REPO.id}/notices`).send({ body: 'second note' });

    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.notice_count).toBe(2);
    expect(repo.latest_notice.body).toBe('second note');

    const list = await request(app).get(`/api/repos/${REPO.id}/notices`);
    expect(list.body.notices.map((n) => n.body)).toEqual(['second note', 'first note']);
  });

  it('returns all notices sortable by date and repo name', async () => {
    const desc = await request(app).get('/api/notices?sort=date&dir=desc');
    expect(desc.status).toBe(200);
    expect(desc.body.notices.length).toBeGreaterThanOrEqual(2);
    expect(desc.body.notices[0].body).toBe('second note');

    const asc = await request(app).get('/api/notices?sort=date&dir=asc');
    expect(asc.body.notices[0].body).toBe('first note');

    const byRepo = await request(app).get('/api/notices?sort=repo&dir=asc');
    expect(byRepo.status).toBe(200);
    expect(byRepo.body.notices.every((n) => typeof n.full_name === 'string' || n.full_name === null)).toBe(true);
  });

  it('deletes a notice and updates the count', async () => {
    const list = await request(app).get(`/api/repos/${REPO.id}/notices`);
    const target = list.body.notices[0].id;

    const del = await request(app).delete(`/api/notices/${target}`);
    expect(del.body).toEqual({ ok: true });

    const after = await request(app).get('/api/repos');
    const repo = after.body.repos.find((r) => r.id === REPO.id);
    expect(repo.notice_count).toBe(1);
  });
});

describe('tags', () => {
  it('rejects an empty tag with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/tags`).send({ tag: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty/);
  });

  it('adds normalised tags, dedupes, and exposes them on the board payload', async () => {
    await request(app).post(`/api/repos/${REPO.id}/tags`).send({ tag: '  Infra  ' });
    await request(app).post(`/api/repos/${REPO.id}/tags`).send({ tag: 'infra' }); // dup after normalise
    await request(app).post(`/api/repos/${REPO.id}/tags`).send({ tag: 'oss' });

    const list = await request(app).get(`/api/repos/${REPO.id}/tags`);
    expect(list.body.tags).toEqual(['infra', 'oss']);

    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.tags).toEqual(['infra', 'oss']);
  });

  it('lists all tags with counts', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(200);
    const infra = res.body.tags.find((t) => t.tag === 'infra');
    expect(infra).toMatchObject({ tag: 'infra', count: 1 });
  });

  it('removes a tag', async () => {
    const del = await request(app).delete(`/api/repos/${REPO.id}/tags/infra`);
    expect(del.body).toEqual({ ok: true });

    const list = await request(app).get(`/api/repos/${REPO.id}/tags`);
    expect(list.body.tags).toEqual(['oss']);
  });
});

describe('reports', () => {
  it('lists available report kinds', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(200);
    expect(res.body.kinds).toContain('summary');
  });

  it('returns a json report by default', async () => {
    const res = await request(app).get('/api/reports/summary');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ kind: 'summary', columns: ['metric', 'value'] });
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it('renders markdown and csv via the format query', async () => {
    const md = await request(app).get('/api/reports/summary?format=md');
    expect(md.headers['content-type']).toMatch(/text\/markdown/);
    expect(md.text).toContain('## Summary');

    const csv = await request(app).get('/api/reports/summary?format=csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('metric,value');
  });

  it('400s on an unknown report kind', async () => {
    const res = await request(app).get('/api/reports/nope');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown report/);
  });
});

describe('POST /api/refresh', () => {
  it('queues a background sync and returns immediately without blocking on GitHub', async () => {
    let resolveFetch;
    fetchAllRepos.mockImplementationOnce(() => new Promise((r) => { resolveFetch = r; }));

    const res = await request(app).post('/api/refresh');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ ok: true, queued: true, syncing: true }));

    // The board reports the in-flight sync while the GitHub fetch is pending.
    const mid = await request(app).get('/api/repos');
    expect(mid.body.syncing).toBe(true);

    // Let the queued fetch finish so it doesn't leak into later tests.
    resolveFetch([REPO]);
    await new Promise((r) => setTimeout(r, 0));
    const done = await request(app).get('/api/repos');
    expect(done.body.syncing).toBe(false);
  });

  it('swallows a failed background fetch and surfaces it via lastError', async () => {
    fetchAllRepos.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).post('/api/refresh');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 10));
    const board = await request(app).get('/api/repos');
    expect(board.body.lastError).toMatch(/boom/);
  });
});

describe('backup & restore (runs last — mutates shared triage state)', () => {
  it('exports triage tables and round-trips them through restore', async () => {
    await request(app).post(`/api/repos/${REPO.id}/priority`).send({ priority: 1 });
    await request(app).post(`/api/repos/${REPO.id}/tags`).send({ tag: 'backup-me' });
    await request(app).post(`/api/repos/${REPO.id}/notices`).send({ body: 'remember this' });

    const backup = await request(app).get('/api/backup');
    expect(backup.status).toBe(200);
    expect(backup.body).toEqual(
      expect.objectContaining({
        version: expect.any(Number),
        repo_state: expect.any(Array),
        repo_notice: expect.any(Array),
        repo_tag: expect.any(Array),
      })
    );
    expect(backup.body.repo_tag.some((t) => t.tag === 'backup-me')).toBe(true);

    const restore = await request(app).post('/api/restore').send(backup.body);
    expect(restore.status).toBe(200);
    expect(restore.body.ok).toBe(true);

    const after = await request(app).get('/api/repos');
    const repo = after.body.repos.find((r) => r.id === REPO.id);
    expect(repo.tags).toContain('backup-me');
    expect(repo.priority).toBe(1);
  });

  it('rejects a malformed backup with 400', async () => {
    const res = await request(app).post('/api/restore').send({ nope: true });
    expect(res.status).toBe(400);
  });

  it('skips invalid rows and applies defaults/normalisation on restore', async () => {
    const res = await request(app).post('/api/restore').send({
      repo_state: [
        { repo_id: REPO.id }, // minimal row → defaults applied
        { full_name: 'x/y' }, // no repo_id → skipped
      ],
      repo_notice: [
        { repo_id: REPO.id, body: 'kept' },
        { repo_id: REPO.id }, // no body → skipped
      ],
      repo_tag: [
        { repo_id: REPO.id, tag: 'Roadmap' }, // normalised to lower-case
        { repo_id: REPO.id }, // no tag → skipped
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.restored).toEqual({ repo_state: 2, repo_notice: 2, repo_tag: 2 });

    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.tags).toEqual(['roadmap']);
    expect(repo.notice_count).toBe(1);
    expect(repo.priority).toBeNull();
  });
});
