import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// db.js reads DATA_DIR at import time, so point it at a throwaway dir BEFORE
// the app (and its SQLite singleton) are imported.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-dash-routes-'));
process.env.DATA_DIR = tmpDir;
process.env.DEFAULT_INACTIVITY_DAYS = '7';
process.env.SYNC_ON_STARTUP = 'false';
process.env.SYNC_AUTO = 'false';
process.env.GITHUB_TOKEN = 'test-token';

// Mock the gh CLI so tests never shell out.
vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
const { execFileSync } = await import('node:child_process');

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

  it('exposes checked_at on every repo', async () => {
    const res = await request(app).get('/api/repos');
    const repo = res.body.repos.find((r) => r.id === REPO.id);
    expect(repo).toHaveProperty('checked_at');
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
    expect(repo.column).toBe('unchecked');
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

  it('preserves a custom created_at when restoring a deleted notice', async () => {
    const pastDate = '2025-01-15T12:00:00.000Z';
    const add = await request(app)
      .post(`/api/repos/${REPO.id}/notices`)
      .send({ body: 'restored note', created_at: pastDate });
    expect(add.body.ok).toBe(true);

    const list = await request(app).get(`/api/repos/${REPO.id}/notices`);
    const restored = list.body.notices.find((n) => n.body === 'restored note');
    expect(restored.created_at).toBe(pastDate);
  });
});

describe('POST /api/repos/:id/state', () => {
  it('restores priority_set_at and checked_at and reflects them in the payload', async () => {
    const anchor = '2026-05-01T00:00:00.000Z';
    const checked = '2026-05-02T08:00:00.000Z';

    const res = await request(app)
      .post(`/api/repos/${REPO.id}/state`)
      .send({ priority_set_at: anchor, checked_at: checked });
    expect(res.body).toEqual({ ok: true });

    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.priority_set_at).toBe(anchor);
    expect(repo.checked_at).toBe(checked);
  });

  it('accepts null values (clears the schedule, same as /clear)', async () => {
    const res = await request(app)
      .post(`/api/repos/${REPO.id}/state`)
      .send({ priority_set_at: null, checked_at: null });
    expect(res.body).toEqual({ ok: true });

    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.priority_set_at).toBeNull();
    expect(repo.checked_at).toBeNull();
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

  it('deletes a tag everywhere it is used', async () => {
    await request(app).post(`/api/repos/${REPO.id}/tags`).send({ tag: 'doomed' });
    const del = await request(app).delete('/api/tags/Doomed'); // normalised to lower-case
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    expect(del.body.removed).toBe(1);

    const all = await request(app).get('/api/tags');
    expect(all.body.tags.find((t) => t.tag === 'doomed')).toBeUndefined();
  });
});

describe('flags', () => {
  it('rejects an empty flag with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/flags`).send({ flag: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty/);
  });

  it('adds normalised flags, dedupes, and exposes them on the board payload', async () => {
    await request(app).post(`/api/repos/${REPO.id}/flags`).send({ flag: '  Pinned  ' });
    await request(app).post(`/api/repos/${REPO.id}/flags`).send({ flag: 'pinned' }); // dup
    await request(app).post(`/api/repos/${REPO.id}/flags`).send({ flag: 'muted' });

    const list = await request(app).get(`/api/repos/${REPO.id}/flags`);
    expect(list.body.flags).toEqual(['muted', 'pinned']);

    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.flags).toEqual(['muted', 'pinned']);
  });

  it('removes a flag', async () => {
    const del = await request(app).delete(`/api/repos/${REPO.id}/flags/pinned`);
    expect(del.body).toEqual({ ok: true });

    const list = await request(app).get(`/api/repos/${REPO.id}/flags`);
    expect(list.body.flags).toEqual(['muted']);
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
    await request(app).post(`/api/repos/${REPO.id}/flags`).send({ flag: 'pinned' });

    const backup = await request(app).get('/api/backup');
    expect(backup.status).toBe(200);
    expect(backup.body).toEqual(
      expect.objectContaining({
        version: expect.any(Number),
        repo_state: expect.any(Array),
        repo_notice: expect.any(Array),
        repo_tag: expect.any(Array),
        repo_flag: expect.any(Array),
      })
    );
    expect(backup.body.repo_tag.some((t) => t.tag === 'backup-me')).toBe(true);
    expect(backup.body.repo_flag.some((f) => f.flag === 'pinned')).toBe(true);

    const restore = await request(app).post('/api/restore').send(backup.body);
    expect(restore.status).toBe(200);
    expect(restore.body.ok).toBe(true);

    const after = await request(app).get('/api/repos');
    const repo = after.body.repos.find((r) => r.id === REPO.id);
    expect(repo.tags).toContain('backup-me');
    expect(repo.flags).toContain('pinned');
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
    expect(res.body.restored).toEqual({ repo_state: 2, repo_notice: 2, repo_tag: 2, repo_flag: 0 });

    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.tags).toEqual(['roadmap']);
    expect(repo.notice_count).toBe(1);
    expect(repo.priority).toBeNull();
  });
});

describe('POST /api/repos/:id/snooze', () => {
  it('rejects days <= 0 with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/snooze`).send({ days: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive/);
  });

  it('rejects non-finite days with 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/snooze`).send({ days: 'soon' });
    expect(res.status).toBe(400);
  });

  it('places the repo in a future column and records a check timestamp', async () => {
    await request(app).post(`/api/repos/${REPO.id}/clear`);
    const res = await request(app).post(`/api/repos/${REPO.id}/snooze`).send({ days: 3 });
    expect(res.status).toBe(200);
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.column).toBe('day-3');
    expect(repo.checkedAgeDays).toBe(0);
    expect(repo.snooze_until).not.toBeNull();
  });

  it('clears the snooze when the repo is subsequently checked', async () => {
    await request(app).post(`/api/repos/${REPO.id}/snooze`).send({ days: 5 });
    await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 0 });
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.snooze_until).toBeNull();
    expect(repo.column).toBe('day-6');
  });

  it('clears the snooze on touch', async () => {
    await request(app).post(`/api/repos/${REPO.id}/snooze`).send({ days: 5 });
    await request(app).post(`/api/repos/${REPO.id}/touch`);
    const board = await request(app).get('/api/repos');
    const repo = board.body.repos.find((r) => r.id === REPO.id);
    expect(repo.snooze_until).toBeNull();
  });
});

describe('GET /api/settings + PUT /api/settings', () => {
  it('returns env defaults when no DB overrides exist', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.settings).toEqual(expect.objectContaining({
      defaultInactivityDays: 7,
      syncIntervalMinutes: expect.any(Number),
      githubOwners: expect.any(String),
    }));
    expect(res.body.defaults).toEqual(expect.objectContaining({ defaultInactivityDays: 7 }));
  });

  it('PUT stores overrides and GET reflects them', async () => {
    const put = await request(app).put('/api/settings').send({ defaultInactivityDays: 14, syncIntervalMinutes: 30 });
    expect(put.status).toBe(200);
    expect(put.body.ok).toBe(true);

    const get = await request(app).get('/api/settings');
    expect(get.body.settings.defaultInactivityDays).toBe(14);
    expect(get.body.settings.syncIntervalMinutes).toBe(30);
  });

  it('PUT rejects out-of-range defaultInactivityDays', async () => {
    const res = await request(app).put('/api/settings').send({ defaultInactivityDays: 0 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringContaining('defaultInactivityDays')]));
  });

  it('PUT rejects out-of-range syncIntervalMinutes', async () => {
    const res = await request(app).put('/api/settings').send({ syncIntervalMinutes: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringContaining('syncIntervalMinutes')]));
  });

  it('PUT with changed owners reports resyncing: true', async () => {
    await request(app).put('/api/settings').send({ githubOwners: 'some-org' });
    const res = await request(app).put('/api/settings').send({ githubOwners: 'other-org' });
    expect(res.body.resyncing).toBe(true);
  });

  it('effective inactivity days are reflected in GET /api/repos after override', async () => {
    await request(app).put('/api/settings').send({ defaultInactivityDays: 21 });
    const res = await request(app).get('/api/repos');
    expect(res.body.defaultInactivityDays).toBe(21);
    // Reset
    await request(app).put('/api/settings').send({ defaultInactivityDays: 7 });
  });

  it('PUT stores reportSchedule and GET reflects it', async () => {
    const schedule = { cron: '0 8 * * 1-5', outputPath: '/tmp/reports' };
    const put = await request(app).put('/api/settings').send({ reportSchedule: schedule });
    expect(put.status).toBe(200);
    const get = await request(app).get('/api/settings');
    expect(get.body.settings.reportSchedule).toMatchObject(schedule);
  });

  it('PUT accepts null to clear reportSchedule', async () => {
    await request(app).put('/api/settings').send({ reportSchedule: { cron: '0 9 * * *', outputPath: '/tmp' } });
    await request(app).put('/api/settings').send({ reportSchedule: null });
    const get = await request(app).get('/api/settings');
    expect(get.body.settings.reportSchedule).toBeNull();
  });

  it('PUT rejects invalid cron in reportSchedule', async () => {
    const res = await request(app).put('/api/settings').send({ reportSchedule: { cron: 'bad', outputPath: '/tmp' } });
    expect(res.status).toBe(400);
    expect(res.body.errors.join(' ')).toMatch(/cron/);
  });

  it('PUT rejects missing outputPath in reportSchedule', async () => {
    const res = await request(app).put('/api/settings').send({ reportSchedule: { cron: '0 8 * * *' } });
    expect(res.status).toBe(400);
    expect(res.body.errors.join(' ')).toMatch(/outputPath/);
  });
});

describe('GET /api/reports/last-export', () => {
  it('returns null when no export has run', async () => {
    const res = await request(app).get('/api/reports/last-export');
    expect(res.status).toBe(200);
    // May have a value from prior tests that ran exports; just check shape.
    expect('lastExport' in res.body).toBe(true);
  });
});

describe('GET /api/prefs + PUT /api/prefs', () => {
  it('returns null prefs when nothing has been saved yet', async () => {
    const res = await request(app).get('/api/prefs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ prefs: null });
  });

  it('PUT stores prefs and GET reads them back', async () => {
    const payload = { density: 'compact', sort: 'alpha', view: 'list', groupBy: 'day', fields: { lang: false }, filters: { showOwn: true, showForks: false, showArchived: false }, showIgnored: false };
    const put = await request(app).put('/api/prefs').send(payload);
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ ok: true });

    const get = await request(app).get('/api/prefs');
    expect(get.status).toBe(200);
    expect(get.body.prefs).toEqual(payload);
  });

  it('PUT strips unknown keys', async () => {
    await request(app).put('/api/prefs').send({ density: 'comfortable', unknown_key: 'should be dropped' });
    const get = await request(app).get('/api/prefs');
    expect(get.body.prefs).not.toHaveProperty('unknown_key');
    expect(get.body.prefs.density).toBe('comfortable');
  });

  it('PUT overwrites the previous value', async () => {
    await request(app).put('/api/prefs').send({ density: 'comfortable' });
    await request(app).put('/api/prefs').send({ density: 'compact' });
    const get = await request(app).get('/api/prefs');
    expect(get.body.prefs.density).toBe('compact');
  });
});

describe('gh quick-action endpoints', () => {
  beforeEach(() => {
    execFileSync.mockReset();
  });

  it('POST /gh/open shells out to gh repo view --web', async () => {
    execFileSync.mockReturnValue(undefined);
    const res = await request(app).post(`/api/repos/${REPO.id}/gh/open`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(execFileSync).toHaveBeenCalledWith(
      'gh', ['repo', 'view', REPO.full_name, '--web'], { stdio: 'ignore' }
    );
  });

  it('POST /gh/open returns 404 for unknown repo', async () => {
    const res = await request(app).post('/api/repos/9999/gh/open');
    expect(res.status).toBe(404);
  });

  it('GET /gh/prs returns parsed PR list', async () => {
    const fakePrs = [{ number: 7, title: 'Fix bug', url: 'https://github.com/me/alpha/pull/7', author: { login: 'dev' }, createdAt: '2026-06-01T00:00:00Z' }];
    execFileSync.mockReturnValue(JSON.stringify(fakePrs));
    const res = await request(app).get(`/api/repos/${REPO.id}/gh/prs`);
    expect(res.status).toBe(200);
    expect(res.body.prs).toEqual(fakePrs);
    expect(execFileSync).toHaveBeenCalledWith(
      'gh', ['pr', 'list', '--repo', REPO.full_name, '--state', 'open', '--json', 'number,title,url,author,createdAt'],
      { encoding: 'utf8' }
    );
  });

  it('GET /gh/prs returns 404 for unknown repo', async () => {
    const res = await request(app).get('/api/repos/9999/gh/prs');
    expect(res.status).toBe(404);
  });

  it('GET /gh/prs returns 500 when gh fails', async () => {
    execFileSync.mockImplementation(() => { throw new Error('gh: command not found'); });
    const res = await request(app).get(`/api/repos/${REPO.id}/gh/prs`);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/gh: command not found/);
  });

  it('POST /gh/issue creates an issue and returns url + number', async () => {
    execFileSync.mockReturnValue('\nhttps://github.com/me/alpha/issues/42\n');
    const res = await request(app).post(`/api/repos/${REPO.id}/gh/issue`).send({ title: 'Found a bug', body: 'Steps to reproduce...' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.url).toBe('https://github.com/me/alpha/issues/42');
    expect(res.body.number).toBe(42);
    expect(execFileSync).toHaveBeenCalledWith(
      'gh', ['issue', 'create', '--repo', REPO.full_name, '--title', 'Found a bug', '--body', 'Steps to reproduce...'],
      { encoding: 'utf8' }
    );
  });

  it('POST /gh/issue rejects empty title', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/gh/issue`).send({ title: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it('POST /gh/issue returns 404 for unknown repo', async () => {
    const res = await request(app).post('/api/repos/9999/gh/issue').send({ title: 'Test' });
    expect(res.status).toBe(404);
  });

  it('POST /gh/open returns 500 when gh throws', async () => {
    execFileSync.mockImplementation(() => { throw new Error('gh: command not found'); });
    const res = await request(app).post(`/api/repos/${REPO.id}/gh/open`);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/command not found/);
  });

  it('POST /gh/open error path uses full error object when message is empty', async () => {
    execFileSync.mockImplementation(() => { throw new Error(); }); // empty message → falsy
    const res = await request(app).post(`/api/repos/${REPO.id}/gh/open`);
    expect(res.status).toBe(500);
    expect(typeof res.body.error).toBe('string');
  });

  it('POST /gh/issue returns 500 when gh throws', async () => {
    execFileSync.mockImplementation(() => { throw new Error('gh: command not found'); });
    const res = await request(app).post(`/api/repos/${REPO.id}/gh/issue`).send({ title: 'Test issue' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/command not found/);
  });

  it('POST /gh/issue treats non-string title as empty and returns 400', async () => {
    const res = await request(app).post(`/api/repos/${REPO.id}/gh/issue`).send({ title: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it('POST /gh/issue returns null number when gh output has no issue URL', async () => {
    execFileSync.mockReturnValue('github issue created\n'); // no /issues/123 pattern
    const res = await request(app).post(`/api/repos/${REPO.id}/gh/issue`).send({ title: 'Test' });
    expect(res.status).toBe(200);
    expect(res.body.number).toBeNull();
  });
});

describe('GET /api/reports/:kind format aliases', () => {
  it('renders markdown via format=markdown alias', async () => {
    const res = await request(app).get('/api/reports/summary?format=markdown');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/markdown/);
    expect(res.text).toContain('## Summary');
  });
});

describe('POST /api/restore transaction error handling', () => {
  it('returns 400 with "restore failed" when the transaction throws', async () => {
    // Two rows with the same repo_id violate the PRIMARY KEY constraint,
    // causing better-sqlite3 to throw inside the transaction.
    const res = await request(app).post('/api/restore').send({
      repo_state: [{ repo_id: REPO.id }, { repo_id: REPO.id }],
      repo_notice: [],
      repo_tag: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/restore failed/);
  });
});

describe('GET/PUT/DELETE /api/tag-rules', () => {
  it('GET returns empty rules list initially', async () => {
    const res = await request(app).get('/api/tag-rules');
    expect(res.status).toBe(200);
    expect(res.body.rules).toEqual([]);
  });

  it('PUT creates a rule and it appears in GET', async () => {
    const put = await request(app).put('/api/tag-rules/infra').send({ days: 14 });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ ok: true, tag: 'infra', days: 14 });

    const get = await request(app).get('/api/tag-rules');
    expect(get.body.rules).toEqual(expect.arrayContaining([{ tag: 'infra', days: 14 }]));
  });

  it('PUT normalises tag to lowercase', async () => {
    const put = await request(app).put('/api/tag-rules/URGENT').send({ days: 3 });
    expect(put.body.tag).toBe('urgent');
  });

  it('PUT returns 400 for out-of-range days', async () => {
    const res = await request(app).put('/api/tag-rules/x').send({ days: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/days/);
  });

  it('PUT returns 400 for empty tag', async () => {
    const res = await request(app).put('/api/tag-rules/%20').send({ days: 7 });
    expect(res.status).toBe(400);
  });

  it('DELETE removes the rule', async () => {
    await request(app).put('/api/tag-rules/tmp').send({ days: 7 });
    const del = await request(app).delete('/api/tag-rules/tmp');
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ ok: true, removed: 1 });

    const get = await request(app).get('/api/tag-rules');
    expect(get.body.rules.find((r) => r.tag === 'tmp')).toBeUndefined();
  });

  it('tag rule applies to effective_inactivity_days for a tagged repo', async () => {
    await request(app).post(`/api/repos/${REPO.id}/tags`).send({ tag: 'infra' });
    const res = await request(app).get('/api/repos');
    const repo = res.body.repos.find((r) => r.id === REPO.id);
    expect(repo.effective_inactivity_days).toBe(14);
  });
});

describe('POST /api/webhook', () => {
  const sign = (body, secret) =>
    `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
  });

  it('returns 200 and queues refresh for a known event when no secret is configured', async () => {
    const res = await request(app)
      .post('/api/webhook')
      .set('x-github-event', 'push')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ref: 'refs/heads/main' }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, event: 'push' });
  });

  it('returns 200 for an unrecognised event (no refresh, no error)', async () => {
    const res = await request(app)
      .post('/api/webhook')
      .set('x-github-event', 'star')
      .send('{}');
    expect(res.status).toBe(200);
    expect(res.body.event).toBe('star');
  });

  it('returns 401 when secret is set and signature is missing', async () => {
    process.env.WEBHOOK_SECRET = 'mysecret';
    const res = await request(app)
      .post('/api/webhook')
      .set('x-github-event', 'push')
      .send('{}');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/signature/);
  });

  it('returns 401 when secret is set and signature is wrong', async () => {
    process.env.WEBHOOK_SECRET = 'mysecret';
    const res = await request(app)
      .post('/api/webhook')
      .set('x-github-event', 'push')
      .set('x-hub-signature-256', 'sha256=badvalue')
      .send('{}');
    expect(res.status).toBe(401);
  });

  it('returns 200 when secret is set and signature is valid', async () => {
    process.env.WEBHOOK_SECRET = 'mysecret';
    const body = JSON.stringify({ action: 'opened' });
    const sig = sign(body, 'mysecret');
    const res = await request(app)
      .post('/api/webhook')
      .set('x-github-event', 'pull_request')
      .set('x-hub-signature-256', sig)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, event: 'pull_request' });
  });
});

describe('GET /api/repos/:id/activity', () => {
  it('returns empty activity for a repo with no mutations', async () => {
    const res = await request(app).get(`/api/repos/${REPO.id}/activity`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activity)).toBe(true);
  });

  it('logs a check action and GET returns it', async () => {
    await request(app).post(`/api/repos/${REPO.id}/check`).send({ daysAgo: 2 });
    const res = await request(app).get(`/api/repos/${REPO.id}/activity`);
    const entry = res.body.activity.find((e) => e.action === 'check');
    expect(entry).toBeDefined();
    expect(entry.detail).toMatchObject({ daysAgo: 2 });
  });

  it('logs a priority action', async () => {
    await request(app).post(`/api/repos/${REPO.id}/priority`).send({ priority: 1 });
    const res = await request(app).get(`/api/repos/${REPO.id}/activity`);
    const entry = res.body.activity.find((e) => e.action === 'priority');
    expect(entry?.detail).toMatchObject({ priority: 1 });
  });

  it('logs a tag_add action', async () => {
    await request(app).post(`/api/repos/${REPO.id}/tags`).send({ tag: 'log-test' });
    const res = await request(app).get(`/api/repos/${REPO.id}/activity`);
    const entry = res.body.activity.find((e) => e.action === 'tag_add' && e.detail?.tag === 'log-test');
    expect(entry).toBeDefined();
  });

  it('logs a notice_add action', async () => {
    await request(app).post(`/api/repos/${REPO.id}/notices`).send({ body: 'test note' });
    const res = await request(app).get(`/api/repos/${REPO.id}/activity`);
    const entry = res.body.activity.find((e) => e.action === 'notice_add');
    expect(entry?.detail).toMatchObject({ body: 'test note' });
  });

  it('activity entries are ordered newest-first', async () => {
    const res = await request(app).get(`/api/repos/${REPO.id}/activity`);
    const ids = res.body.activity.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });
});

describe('GET/POST /api/undo + POST/DELETE /api/undo/:id', () => {
  const ops = [{ type: 'setIgnored', repoId: REPO.id, fullName: REPO.full_name, ignored: false }];

  it('GET returns empty list initially', async () => {
    const res = await request(app).get('/api/undo');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it('POST creates an entry and GET returns it', async () => {
    const post = await request(app).post('/api/undo').send({ label: 'Ignored 1 repo', ops });
    expect(post.status).toBe(200);
    expect(post.body).toMatchObject({ ok: true, label: 'Ignored 1 repo' });
    const id = post.body.id;

    const get = await request(app).get('/api/undo');
    expect(get.body.entries.find((e) => e.id === id)).toMatchObject({ label: 'Ignored 1 repo' });
  });

  it('POST /undo rejects missing label', async () => {
    const res = await request(app).post('/api/undo').send({ ops });
    expect(res.status).toBe(400);
  });

  it('POST /undo rejects empty ops', async () => {
    const res = await request(app).post('/api/undo').send({ label: 'test', ops: [] });
    expect(res.status).toBe(400);
  });

  it('DELETE /undo/:id discards without executing', async () => {
    const post = await request(app).post('/api/undo').send({ label: 'Discard me', ops });
    const id = post.body.id;
    const del = await request(app).delete(`/api/undo/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.removed).toBe(1);
    const get = await request(app).get('/api/undo');
    expect(get.body.entries.find((e) => e.id === id)).toBeUndefined();
  });

  it('POST /undo/:id executes setIgnored op and removes entry', async () => {
    // First ignore the repo so we have something to undo.
    await request(app).post(`/api/repos/${REPO.id}/ignore`).send({ ignored: true });
    // Create an undo entry.
    const post = await request(app).post('/api/undo').send({ label: 'Ignored repo', ops });
    const id = post.body.id;

    const exec = await request(app).post(`/api/undo/${id}`);
    expect(exec.status).toBe(200);
    expect(exec.body.ok).toBe(true);

    // Entry should be gone.
    const get = await request(app).get('/api/undo');
    expect(get.body.entries.find((e) => e.id === id)).toBeUndefined();

    // Repo should be unignored.
    const repos = await request(app).get('/api/repos');
    const repo = repos.body.repos.find((r) => r.id === REPO.id);
    expect(repo.ignored).toBe(false);
  });

  it('POST /undo/:id returns 404 for unknown id', async () => {
    const res = await request(app).post('/api/undo/99999');
    expect(res.status).toBe(404);
  });
});
