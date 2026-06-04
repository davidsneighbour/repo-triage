import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { api } from './api.js';

vi.mock('./api.js', () => ({
  api: {
    list: vi.fn(),
    refresh: vi.fn(),
    setPriority: vi.fn(),
    clearSchedule: vi.fn(),
    setChecked: vi.fn(),
    touch: vi.fn(),
    setInactivity: vi.fn(),
    reorder: vi.fn(),
  },
}));

const card = (id, name, priority = null) => ({
  id, name, full_name: `me/${name}`, html_url: `https://x/${name}`, description: '',
  private: false, archived: false, fork: false, language: 'JS',
  pushed_at: '2026-06-01T00:00:00.000Z', checkedAgeDays: 0, dueInDays: 7,
  needsCheckToday: false, column: 'day-0', position: id, tags: [], priority,
});

const payload = {
  repos: [card(1, 'alpha', 1), card(2, 'beta', 2), card(3, 'gamma', null)],
  cacheReady: true, syncing: false, defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z', username: null, owners: [],
  sourceWarnings: [], tokenPresent: true, lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('triage priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.setPriority.mockResolvedValue({ ok: true });
  });

  it('shows a priority chip on prioritised cards only', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    expect(screen.getByTitle('Priority 1 (high)')).toBeInTheDocument();
    expect(screen.getByTitle('Priority 2 (medium)')).toBeInTheDocument();
    // gamma has no priority → no chip
    expect(screen.queryByTitle('Priority 3 (low)')).not.toBeInTheDocument();
  });

  it('sets a priority from the card menu', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'gamma' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open repository settings' })[2]);
    fireEvent.click(screen.getByRole('button', { name: 'P2' }));

    await waitFor(() => expect(api.setPriority).toHaveBeenCalledWith(3, 2));
  });

  it('toggles a priority off when re-selecting the active level', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open repository settings' })[0]);
    // alpha is P1; clicking P1 again clears it
    fireEvent.click(screen.getByRole('button', { name: 'P1' }));

    await waitFor(() => expect(api.setPriority).toHaveBeenCalledWith(1, null));
  });
});
