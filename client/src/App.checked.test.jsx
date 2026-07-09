import { render, screen } from '@testing-library/react';
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

const card = (over) => ({
  id: 1, name: 'r', full_name: 'me/r', owner: 'me', html_url: 'https://x/r',
  description: 'd', private: false, archived: false, fork: false, language: 'JS',
  pushed_at: '2026-06-01T00:00:00.000Z', dueInDays: 0, needsCheckToday: true,
  column: 'day-0', position: 0, ...over,
});

const payload = {
  repos: [
    card({ id: 1, name: 'fresh', checkedAgeDays: null }),
    card({ id: 2, name: 'today', checkedAgeDays: 0 }),
    card({ id: 3, name: 'stale', checkedAgeDays: 3 }),
  ],
  cacheReady: true,
  syncing: false,
  defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z',
  owners: [],
  sourceWarnings: [],
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('checked-age wording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
  });

  it('shows "not checked yet", "checked today", and "checked Nd ago"', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'fresh' });

    expect(screen.getByText('not checked yet')).toBeInTheDocument();
    expect(screen.getByText('checked today')).toBeInTheDocument();
    expect(screen.getByText('checked 3d ago')).toBeInTheDocument();
  });
});
