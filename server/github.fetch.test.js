import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllRepos, rateLimit } from './github.js';

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

beforeEach(() => {
  // rateLimit is a shared singleton — reset it so tests don't bleed into each other.
  Object.assign(rateLimit, {
    limit: null, remaining: null, used: null, reset: null, lastChecked: null, authInvalid: false,
  });
  process.env.GITHUB_TOKEN = 'test-token';
  delete process.env.GITHUB_USERNAME;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAllRepos', () => {
  it('throws when no token is configured', async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(fetchAllRepos()).rejects.toThrow(/GITHUB_TOKEN is not set/);
  });

  it('short-circuits when the rate limit is known to be exhausted', async () => {
    rateLimit.remaining = 0;
    rateLimit.reset = Math.floor(Date.now() / 1000) + 600; // resets in the future
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
    rateLimit.authInvalid = true; // should be reset after a clean fetch

    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1, name: `r${i}`, full_name: `me/r${i}`, description: null,
      private: false, archived: false, fork: false, html_url: `https://x/${i}`,
      language: 'JS', pushed_at: null, updated_at: null,
      stargazers_count: 0, open_issues_count: 0,
    }));
    const lastPage = [{
      id: 101, name: 'last', full_name: 'me/last', description: 'd',
      private: true, archived: true, fork: true, html_url: 'https://x/last',
      language: 'Go', pushed_at: null, updated_at: null,
      stargazers_count: 3, open_issues_count: 2,
      extra_field_should_be_dropped: 'x',
    }];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeRes({ body: fullPage, headers: RATE_HEADERS }))
      .mockResolvedValueOnce(makeRes({ body: lastPage, headers: RATE_HEADERS }));
    vi.stubGlobal('fetch', fetchMock);

    const repos = await fetchAllRepos();

    expect(fetchMock).toHaveBeenCalledTimes(2); // first page full -> fetch page 2
    expect(repos).toHaveLength(101);
    expect(rateLimit.authInvalid).toBe(false);
    expect(repos[100]).not.toHaveProperty('extra_field_should_be_dropped');
    expect(repos[100]).toMatchObject({ id: 101, full_name: 'me/last', private: true, fork: true });
  });

  it('uses the public user endpoint when GITHUB_USERNAME is set', async () => {
    process.env.GITHUB_USERNAME = 'octocat';
    const fetchMock = vi.fn().mockResolvedValue(makeRes({ body: [], headers: RATE_HEADERS }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchAllRepos();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/users/octocat/repos');
  });
});
