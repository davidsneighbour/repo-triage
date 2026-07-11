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
    allIssues: vi.fn(),
    allActivity: vi.fn(),
    setIssueFlagged: vi.fn(),
  },
}));

const payload = {
  repos: [
    {
      id: 1, name: 'alpha', full_name: 'me/alpha', html_url: 'https://x/alpha', description: '',
      private: false, archived: false, fork: false, language: 'JS', pushed_at: '2026-06-01T00:00:00.000Z',
      checkedAgeDays: 0, dueInDays: 7, needsCheckToday: false, column: 'day-0', position: 0,
    },
  ],
  cacheReady: true, syncing: false, defaultInactivityDays: 7, lastFetch: '2026-06-03T00:00:00.000Z',
  owners: [], sourceWarnings: [], tokenPresent: true, lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('Event log view wiring from the toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.allActivity.mockResolvedValue({ activity: [] });
  });

  it('opens the event log from the toolbar "activity" button and closes it, without a per-repo sync call', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getByRole('button', { name: 'activity' }));

    expect(await screen.findByRole('heading', { name: 'Event log' })).toBeInTheDocument();
    await waitFor(() => expect(api.allActivity).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Close event log' }));
    expect(screen.queryByRole('heading', { name: 'Event log' })).not.toBeInTheDocument();
  });

  it('is not rendered with role="dialog" (non-modal, per #78)', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getByRole('button', { name: 'activity' }));

    const region = await screen.findByRole('region', { name: 'Event log' });
    expect(region).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Event log' })).not.toBeInTheDocument();
  });
});
