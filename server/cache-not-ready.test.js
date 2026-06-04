import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Fresh module instance (own SQLite file) so the cache starts cold — we hit
// /api/repos *before* any refresh runs, exercising the not-ready branch.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-dash-cold-'));
process.env.DATA_DIR = tmpDir;
process.env.SYNC_ON_STARTUP = 'false';
process.env.SYNC_AUTO = 'false';
process.env.GITHUB_TOKEN = 'test-token';

vi.mock('./github.js', () => ({
  rateLimit: { limit: 5000, remaining: 4999, used: 1, reset: null, lastChecked: null, authInvalid: false },
  sourceStatus: { owners: [], warnings: [] },
  authStatus: { source: 'env', present: true },
  fetchAllRepos: vi.fn(),
  parseRateLimitHeaders: vi.fn(),
  parseOwners: () => [],
}));

const { app } = await import('./index.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/repos before the first sync', () => {
  it('responds with an empty, not-ready board', async () => {
    const res = await request(app).get('/api/repos');
    expect(res.status).toBe(200);
    expect(res.body.cacheReady).toBe(false);
    expect(res.body.repos).toEqual([]);
  });
});
