import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { api } from './api.js';

vi.mock('./api.js', () => ({
  api: {
    list: vi.fn(),
    getTags: vi.fn(),
    refresh: vi.fn(),
    setPriority: vi.fn(),
    setChecked: vi.fn(),
    touch: vi.fn(),
    setInactivity: vi.fn(),
    reorder: vi.fn(),
  },
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('App cache hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('shows cached data immediately and updates when API payload arrives', async () => {
    window.localStorage.setItem(
      'repo-triage-board-cache-v1',
      JSON.stringify({
        savedAt: '2026-06-03T00:00:00.000Z',
        payload: {
          repos: [
            {
              id: 1,
              name: 'cached-repo',
              full_name: 'user/cached-repo',
              html_url: 'https://example.com/cached-repo',
              description: 'cached description',
              private: false,
              archived: false,
              fork: false,
              language: 'JavaScript',
              pushed_at: '2026-06-01T00:00:00.000Z',
              checkedAgeDays: 0,
              dueInDays: 7,
              needsCheckToday: false,
              column: 'day-0',
              position: 0,
            },
          ],
          cacheReady: true,
          defaultInactivityDays: 7,
          lastFetch: '2026-06-03T00:00:00.000Z',
          tokenPresent: true,
          lastError: null,
          rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
        },
      })
    );

    const req = deferred();
    api.list.mockReturnValueOnce(req.promise);

    render(<App />);

    expect(screen.getByText('cached-repo')).toBeInTheDocument();
    expect(screen.getByText('Showing cached board while refreshing from GitHub.')).toBeInTheDocument();

    await act(async () => {
      req.resolve({
        repos: [
          {
            id: 2,
            name: 'fresh-repo',
            full_name: 'user/fresh-repo',
            html_url: 'https://example.com/fresh-repo',
            description: 'fresh description',
            private: false,
            archived: false,
            fork: false,
            language: 'TypeScript',
            pushed_at: '2026-06-02T00:00:00.000Z',
            checkedAgeDays: 1,
            dueInDays: 6,
            needsCheckToday: false,
            column: 'day-0',
            position: 0,
          },
        ],
        cacheReady: true,
        defaultInactivityDays: 7,
        lastFetch: '2026-06-03T01:00:00.000Z',
        tokenPresent: true,
        lastError: null,
        rateLimit: { remaining: 900, limit: 5000, used: 4100, authInvalid: false },
      });
      await req.promise;
    });

    await waitFor(() => {
      expect(screen.getByText('fresh-repo')).toBeInTheDocument();
    });

    expect(screen.queryByText('cached-repo')).not.toBeInTheDocument();
    expect(screen.queryByText('Showing cached board while refreshing from GitHub.')).not.toBeInTheDocument();

    const cached = JSON.parse(window.localStorage.getItem('repo-triage-board-cache-v1'));
    expect(cached.payload.repos[0].name).toBe('fresh-repo');
  });

  it('keeps the cached board (and stored cache) when the server is not ready yet', async () => {
    window.localStorage.setItem(
      'repo-triage-board-cache-v1',
      JSON.stringify({
        savedAt: '2026-06-03T00:00:00.000Z',
        payload: {
          repos: [
            {
              id: 1,
              name: 'cached-repo',
              full_name: 'user/cached-repo',
              html_url: 'https://example.com/cached-repo',
              description: 'cached description',
              private: false,
              archived: false,
              fork: false,
              language: 'JavaScript',
              pushed_at: '2026-06-01T00:00:00.000Z',
              checkedAgeDays: 0,
              dueInDays: 7,
              needsCheckToday: false,
              column: 'day-0',
              position: 0,
            },
          ],
          cacheReady: true,
          syncing: false,
          defaultInactivityDays: 7,
          lastFetch: '2026-06-03T00:00:00.000Z',
          tokenPresent: true,
          lastError: null,
          rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
        },
      })
    );

    // Fresh server start: cache not warmed yet, so it returns an empty list.
    api.list.mockResolvedValue({
      repos: [],
      cacheReady: false,
      syncing: true,
      defaultInactivityDays: 7,
      lastFetch: null,
      tokenPresent: true,
      lastError: null,
      rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
    });

    render(<App />);

    expect(screen.getByText('cached-repo')).toBeInTheDocument();

    await waitFor(() => expect(api.list).toHaveBeenCalled());

    // The not-ready payload must not blow the board away or persist over the cache.
    expect(screen.getByText('cached-repo')).toBeInTheDocument();
    expect(screen.getByText('Showing cached board while refreshing from GitHub.')).toBeInTheDocument();
    const cached = JSON.parse(window.localStorage.getItem('repo-triage-board-cache-v1'));
    expect(cached.payload.repos[0].name).toBe('cached-repo');
  });
});
