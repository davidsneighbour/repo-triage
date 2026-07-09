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
  },
}));

const payload = {
  repos: [
    {
      id: 5, name: 'kbd-repo', full_name: 'me/kbd-repo', html_url: 'https://x/kbd', description: '',
      private: false, archived: false, fork: false, language: 'JS', pushed_at: '2026-06-01T00:00:00.000Z',
      checkedAgeDays: 3, dueInDays: 4, needsCheckToday: false, column: 'day-3', boardOffset: 3, position: 0,
    },
  ],
  cacheReady: true, syncing: false, defaultInactivityDays: 7, lastFetch: '2026-06-03T00:00:00.000Z',
  owners: [], sourceWarnings: [], tokenPresent: true, lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('keyboard scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.setChecked.mockResolvedValue({ ok: true });
  });

  it('] pushes the card one column further out', async () => {
    render(<App />);
    const link = await screen.findByRole('link', { name: 'kbd-repo' });

    fireEvent.keyDown(link, { key: ']' });
    // boardOffset 3 -> 4, daysAgo = 7 - 4 = 3
    await waitFor(() => expect(api.setChecked).toHaveBeenCalledWith(5, 3));
  });

  it('[ pulls the card one column toward Today', async () => {
    render(<App />);
    const link = await screen.findByRole('link', { name: 'kbd-repo' });

    fireEvent.keyDown(link, { key: '[' });
    // boardOffset 3 -> 2, daysAgo = 7 - 2 = 5
    await waitFor(() => expect(api.setChecked).toHaveBeenCalledWith(5, 5));
  });
});
