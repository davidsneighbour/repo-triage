import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    setIgnored: vi.fn(),
    addNotice: vi.fn(),
    repoIssues: vi.fn(),
    syncRepoIssues: vi.fn(),
    setIssueSync: vi.fn(),
  },
}));

const repoA = {
  id: 1,
  name: 'repo-a',
  full_name: 'user/repo-a',
  html_url: 'https://example.com/repo-a',
  description: 'visible repo',
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
  inactivity_days: null,
  ignored: false,
  notice_count: 0,
  latest_notice: null,
};

const payload = {
  repos: [repoA],
  cacheReady: true,
  defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z',
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('Issues dialog wiring from the card menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.repoIssues.mockResolvedValue({ issues: [], syncEnabled: true });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 0 });
  });

  it('opens the issues dialog for the right repo from "Browse issues" and closes it', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'repo-a' });

    fireEvent.click(screen.getByRole('button', { name: 'Open repository settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Browse issues' }));

    expect(await screen.findByRole('heading', { name: 'Issues' })).toBeInTheDocument();
    expect(screen.getByText('user/repo-a')).toBeInTheDocument();
    await waitFor(() => expect(api.repoIssues).toHaveBeenCalledWith(1));

    fireEvent.click(screen.getByRole('button', { name: 'Close issues' }));
    expect(screen.queryByRole('heading', { name: 'Issues' })).not.toBeInTheDocument();
  });
});
