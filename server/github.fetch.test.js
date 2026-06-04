import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { authStatus, fetchAllRepos, parseOwners, rateLimit, sourceStatus } from './github.js';

// `gh auth token` is shelled out via execFileSync — mock it so it's deterministic.
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => {
    throw new Error('gh not available');
  }),
}));

// Build a minimal fetch Response stand-in.
function makeRes({ status = 200, body = [], headers = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => (k in headers ? headers[k] : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const RATE_HEADERS = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4990',
  'x-ratelimit-used': '10',
  'x-ratelimit-reset': '1700000000',
};

// Route a fetch call to the first matching rule (by URL substring).
function routeFetch(rules) {
  return vi.fn(async (url) => {
    for (const [needle, res] of rules) {
      if (url.includes(needle)) return typeof res === 'function' ? res() : res;
    }
    throw new Error(`unexpected fetch URL in test: ${url}`);
  });
}

const repo = (over = {}) => ({
  id: 1, name: 'r', full_name: 'o/r', owner: { login: 'o', type: 'Organization' },
  description: null, private: false, archived: false, fork: false, html_url: 'https://x/r',
  language: 'JS', pushed_at: null, updated_at: null, stargazers_count: 0, open_issues_count: 0,
  ...over,
});

beforeEach(() => {
  // rateLimit + sourceStatus are shared singletons — reset between tests.
  Object.assign(rateLimit, {
    limit: null, remaining: null, used: null, reset: null, lastChecked: null, authInvalid: false,
  });
  sourceStatus.owners = [];
  sourceStatus.warnings = [];
  authStatus.source = null;
  authStatus.present = false;
  process.env.GITHUB_TOKEN = 'test-token';
  delete process.env.GITHUB_USERNAME;
  delete process.env.GITHUB_OWNERS;
  // Default: gh has no token; individual tests opt in via mockReturnValueOnce.
  execFileSync.mockReset();
  execFileSync.mockImplementation(() => {
    throw new Error('gh not available');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseOwners', () => {
  it('returns [] for blank/undefined', () => {
    expect(parseOwners(undefined)).toEqual([]);
    expect(parseOwners('')).toEqual([]);
    expect(parseOwners('   ')).toEqual([]);
  });

  it('splits comma/space separated lists', () => {
    expect(parseOwners('davidsneighbour, dnbhq gohugo-ananke')).toEqual(['davidsneighbour', 'dnbhq', 'gohugo-ananke']);
  });

  it('parses a JSON array', () => {
    expect(parseOwners('["davidsneighbour","dnbhq"]')).toEqual(['davidsneighbour', 'dnbhq']);
  });

  it('de-duplicates case-insensitively, preserving first spelling/order', () => {
    expect(parseOwners('dnbhq, DNBHQ, gohugo-ananke')).toEqual(['dnbhq', 'gohugo-ananke']);
  });
});

describe('token resolution (env vs gh CLI)', () => {
  it('uses GITHUB_TOKEN and never invokes gh when it is set', async () => {
    process.env.GITHUB_TOKEN = 'env-token';
    const fetchMock = vi.fn().mockResolvedValue(makeRes({ body: [], headers: RATE_HEADERS }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchAllRepos();

    expect(authStatus).toMatchObject({ source: 'env', present: true });
    expect(execFileSync).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer env-token');
  });

  it('falls back to `gh auth token` when GITHUB_TOKEN is unset', async () => {
    delete process.env.GITHUB_TOKEN;
    execFileSync.mockReturnValueOnce('gh-cli-token\n');
    const fetchMock = vi.fn().mockResolvedValue(makeRes({ body: [], headers: RATE_HEADERS }));
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();

    expect(repos).toEqual([]);
    expect(execFileSync).toHaveBeenCalledWith('gh', ['auth', 'token'], expect.any(Object));
    expect(authStatus).toMatchObject({ source: 'gh', present: true });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer gh-cli-token');
  });
});

describe('fetchAllRepos — default (no owners configured)', () => {
  it('throws when no token is configured and gh has none', async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(fetchAllRepos()).rejects.toThrow(/No GitHub token found/);
    expect(authStatus.present).toBe(false);
  });

  it('short-circuits when the rate limit is known to be exhausted', async () => {
    rateLimit.remaining = 0;
    rateLimit.reset = Math.floor(Date.now() / 1000) + 600;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAllRepos()).rejects.toThrow(/rate limit exhausted/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the token invalid and surfaces the GitHub message on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeRes({ status: 401, headers: RATE_HEADERS, body: { message: 'Bad credentials' } })
    ));
    await expect(fetchAllRepos()).rejects.toThrow(/invalid or expired \(401\).*Bad credentials/s);
    expect(rateLimit.authInvalid).toBe(true);
  });

  it('handles a 401 with a non-JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeRes({ status: 401, headers: RATE_HEADERS, body: 'nope' })
    ));
    await expect(fetchAllRepos()).rejects.toThrow(/invalid or expired \(401\)/);
    expect(rateLimit.authInvalid).toBe(true);
  });

  it('reports rate-limit exhaustion when a 403 arrives with remaining 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeRes({ status: 403, headers: { ...RATE_HEADERS, 'x-ratelimit-remaining': '0' }, body: 'forbidden' })
    ));
    await expect(fetchAllRepos()).rejects.toThrow(/rate limit exhausted \(403\)/);
  });

  it('reports a generic 403 when the limit is not the cause', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeRes({ status: 403, headers: RATE_HEADERS, body: 'abuse detection' })
    ));
    await expect(fetchAllRepos()).rejects.toThrow(/403 Forbidden.*abuse detection/s);
  });

  it('throws for other non-ok statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeRes({ status: 500, headers: RATE_HEADERS, body: 'server error' })
    ));
    await expect(fetchAllRepos()).rejects.toThrow(/GitHub API 500.*server error/s);
  });

  it('maps fields, paginates, and clears authInvalid on success', async () => {
    rateLimit.authInvalid = true;

    const fullPage = Array.from({ length: 100 }, (_, i) => repo({
      id: i + 1, name: `r${i}`, full_name: `me/r${i}`, owner: { login: 'me', type: 'User' },
    }));
    const lastPage = [repo({
      id: 101, name: 'last', full_name: 'me/last', owner: { login: 'me', type: 'User' },
      private: true, archived: true, fork: true, language: 'Go', stargazers_count: 3, open_issues_count: 2,
      extra_field_should_be_dropped: 'x',
    })];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeRes({ body: fullPage, headers: RATE_HEADERS }))
      .mockResolvedValueOnce(makeRes({ body: lastPage, headers: RATE_HEADERS }));
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/user/repos');
    expect(repos).toHaveLength(101);
    expect(rateLimit.authInvalid).toBe(false);
    expect(repos[100]).not.toHaveProperty('extra_field_should_be_dropped');
    expect(repos[100]).toMatchObject({ id: 101, full_name: 'me/last', owner: 'me', owner_type: 'User', private: true, fork: true });
  });
});

describe('fetchAllRepos — configured owners', () => {
  it('loads the token owner via /user/repos (private included) when listed by login', async () => {
    process.env.GITHUB_OWNERS = 'davidsneighbour';
    const fetchMock = routeFetch([
      ['/user/repos', () => makeRes({ body: [repo({ id: 5, full_name: 'davidsneighbour/x', owner: { login: 'davidsneighbour', type: 'User' }, private: true })], headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'davidsneighbour' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({ id: 5, owner: 'davidsneighbour', private: true });
    expect(sourceStatus.warnings).toEqual([]);
    expect(sourceStatus.owners[0]).toMatchObject({ owner: 'davidsneighbour', scope: 'self' });
  });

  it('loads a member org via /orgs with no warning', async () => {
    process.env.GITHUB_OWNERS = 'dnbhq';
    const fetchMock = routeFetch([
      ['/orgs/dnbhq/repos', () => makeRes({ body: [repo({ id: 9, full_name: 'dnbhq/secret', owner: { login: 'dnbhq', type: 'Organization' }, private: true })], headers: RATE_HEADERS })],
      ['/user/memberships/orgs/dnbhq', () => makeRes({ body: { state: 'active' }, headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos.map((r) => r.id)).toEqual([9]);
    expect(sourceStatus.warnings).toEqual([]);
    expect(sourceStatus.owners[0]).toMatchObject({ owner: 'dnbhq', scope: 'member' });
  });

  it('falls back to public repos with a warning when not an org member', async () => {
    process.env.GITHUB_OWNERS = 'gohugo-ananke';
    const fetchMock = routeFetch([
      ['/orgs/gohugo-ananke/repos', () => makeRes({ body: [repo({ id: 7, full_name: 'gohugo-ananke/theme', owner: { login: 'gohugo-ananke', type: 'Organization' } })], headers: RATE_HEADERS })],
      ['/user/memberships/orgs/gohugo-ananke', () => makeRes({ status: 404, body: 'Not Found', headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos.map((r) => r.id)).toEqual([7]);
    expect(sourceStatus.warnings.join(' ')).toMatch(/not a member of organization "gohugo-ananke"/);
    expect(sourceStatus.owners[0]).toMatchObject({ owner: 'gohugo-ananke', scope: 'public' });
  });

  it('treats a non-org owner as a user (404 on /orgs → /users/:owner/repos)', async () => {
    process.env.GITHUB_OWNERS = 'octocat';
    const fetchMock = routeFetch([
      ['/orgs/octocat/repos', () => makeRes({ status: 404, body: 'Not Found', headers: RATE_HEADERS })],
      ['/users/octocat/repos', () => makeRes({ body: [repo({ id: 3, full_name: 'octocat/hello', owner: { login: 'octocat', type: 'User' } })], headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos.map((r) => r.id)).toEqual([3]);
    expect(sourceStatus.warnings).toEqual([]);
  });

  it('warns and falls back to public on a 403 org listing', async () => {
    process.env.GITHUB_OWNERS = 'secret-org';
    const fetchMock = routeFetch([
      ['/orgs/secret-org/repos', () => makeRes({ status: 403, body: 'forbidden', headers: RATE_HEADERS })],
      ['/users/secret-org/repos', () => makeRes({ body: [repo({ id: 4, full_name: 'secret-org/pub', owner: { login: 'secret-org', type: 'Organization' } })], headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos.map((r) => r.id)).toEqual([4]);
    expect(sourceStatus.warnings.join(' ')).toMatch(/not authorized for organization "secret-org" \(403\)/);
  });

  it('de-duplicates repos that appear under more than one owner', async () => {
    process.env.GITHUB_OWNERS = 'a,b';
    const shared = repo({ id: 42, full_name: 'a/shared', owner: { login: 'a', type: 'Organization' } });
    const fetchMock = routeFetch([
      ['/orgs/a/repos', () => makeRes({ body: [shared], headers: RATE_HEADERS })],
      ['/orgs/b/repos', () => makeRes({ body: [shared], headers: RATE_HEADERS })],
      ['/user/memberships/orgs/a', () => makeRes({ body: { state: 'active' }, headers: RATE_HEADERS })],
      ['/user/memberships/orgs/b', () => makeRes({ body: { state: 'active' }, headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos.map((r) => r.id)).toEqual([42]);
  });

  it('records a per-owner warning (not a hard failure) when one owner errors', async () => {
    process.env.GITHUB_OWNERS = 'good-org, broken';
    const fetchMock = routeFetch([
      ['/orgs/good-org/repos', () => makeRes({ body: [repo({ id: 1, full_name: 'good-org/a', owner: { login: 'good-org', type: 'Organization' } })], headers: RATE_HEADERS })],
      ['/user/memberships/orgs/good-org', () => makeRes({ body: { state: 'active' }, headers: RATE_HEADERS })],
      ['/orgs/broken/repos', () => makeRes({ status: 500, body: 'boom', headers: RATE_HEADERS })],
      ['/users/broken/repos', () => makeRes({ status: 500, body: 'boom', headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos.map((r) => r.id)).toEqual([1]);
    expect(sourceStatus.warnings.join(' ')).toMatch(/Could not load "broken".*500/);
  });

  it('still treats GITHUB_USERNAME as a single-owner alias', async () => {
    process.env.GITHUB_USERNAME = 'octocat';
    const fetchMock = routeFetch([
      ['/orgs/octocat/repos', () => makeRes({ status: 404, body: 'Not Found', headers: RATE_HEADERS })],
      ['/users/octocat/repos', () => makeRes({ body: [], headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAllRepos();
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/users/octocat/repos'))).toBe(true);
  });

  it('derives the owner from full_name when the repo has no owner object', async () => {
    process.env.GITHUB_OWNERS = 'octocat';
    const fetchMock = routeFetch([
      ['/orgs/octocat/repos', () => makeRes({ status: 404, body: 'Not Found', headers: RATE_HEADERS })],
      ['/users/octocat/repos', () => makeRes({ body: [repo({ id: 8, full_name: 'octocat/orphan', owner: undefined })], headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos[0]).toMatchObject({ id: 8, owner: 'octocat', owner_type: null });
  });

  it('counts a "pending" org membership as a member (private scope)', async () => {
    process.env.GITHUB_OWNERS = 'dnbhq';
    const fetchMock = routeFetch([
      ['/orgs/dnbhq/repos', () => makeRes({ body: [repo({ id: 9, full_name: 'dnbhq/x', owner: { login: 'dnbhq', type: 'Organization' } })], headers: RATE_HEADERS })],
      ['/user/memberships/orgs/dnbhq', () => makeRes({ body: { state: 'pending' }, headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAllRepos();
    expect(sourceStatus.owners[0]).toMatchObject({ owner: 'dnbhq', scope: 'member' });
    expect(sourceStatus.warnings).toEqual([]);
  });

  it('records a per-owner warning when the token owner\'s own /user/repos fails', async () => {
    process.env.GITHUB_OWNERS = 'me';
    const fetchMock = routeFetch([
      ['/user/repos', () => makeRes({ status: 500, body: 'boom', headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos).toEqual([]);
    expect(sourceStatus.owners[0]).toMatchObject({ owner: 'me', scope: 'error' });
  });

  it('leaves viewerLogin unresolved when /user is unavailable (owner falls to org path)', async () => {
    process.env.GITHUB_OWNERS = 'me';
    const fetchMock = routeFetch([
      ['/user/memberships/orgs/me', () => makeRes({ status: 404, body: 'Not Found', headers: RATE_HEADERS })],
      ['/orgs/me/repos', () => makeRes({ status: 404, body: 'Not Found', headers: RATE_HEADERS })],
      ['/users/me/repos', () => makeRes({ body: [repo({ id: 2, full_name: 'me/pub', owner: { login: 'me', type: 'User' } })], headers: RATE_HEADERS })],
      // /user itself errors → viewerLogin stays null, so "me" is not treated as self.
      ['/user', () => makeRes({ status: 500, body: 'boom', headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos.map((r) => r.id)).toEqual([2]);
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/user/repos'))).toBe(false);
  });

  it('treats a non-active org membership as public-only', async () => {
    process.env.GITHUB_OWNERS = 'dnbhq';
    const fetchMock = routeFetch([
      ['/orgs/dnbhq/repos', () => makeRes({ body: [repo({ id: 9, full_name: 'dnbhq/x', owner: { login: 'dnbhq', type: 'Organization' } })], headers: RATE_HEADERS })],
      ['/user/memberships/orgs/dnbhq', () => makeRes({ body: { state: 'inactive' }, headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAllRepos();
    expect(sourceStatus.owners[0]).toMatchObject({ owner: 'dnbhq', scope: 'public' });
    expect(sourceStatus.warnings.join(' ')).toMatch(/not a member of organization "dnbhq"/);
  });

  it('surfaces a 403 from a user listing as a per-owner warning', async () => {
    process.env.GITHUB_OWNERS = 'octocat';
    const fetchMock = routeFetch([
      ['/orgs/octocat/repos', () => makeRes({ status: 404, body: 'Not Found', headers: RATE_HEADERS })],
      ['/users/octocat/repos', () => makeRes({ status: 403, body: 'forbidden', headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos).toEqual([]);
    expect(sourceStatus.warnings.join(' ')).toMatch(/Could not load "octocat".*403 Forbidden/);
  });

  it('yields no repos when an org 403 falls back to a public listing that also fails', async () => {
    process.env.GITHUB_OWNERS = 'secret-org';
    const fetchMock = routeFetch([
      ['/orgs/secret-org/repos', () => makeRes({ status: 403, body: 'forbidden', headers: RATE_HEADERS })],
      ['/users/secret-org/repos', () => makeRes({ status: 500, body: 'boom', headers: RATE_HEADERS })],
      ['/user', () => makeRes({ body: { login: 'me' }, headers: RATE_HEADERS })],
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();
    expect(repos).toEqual([]);
    expect(sourceStatus.owners[0]).toMatchObject({ owner: 'secret-org', scope: 'public', count: 0 });
    expect(sourceStatus.warnings.join(' ')).toMatch(/not authorized for organization "secret-org" \(403\)/);
  });
});
