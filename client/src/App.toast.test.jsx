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
    setIgnored: vi.fn(),
    addNotice: vi.fn(),
    addTag: vi.fn(),
    removeTag: vi.fn(),
    restoreState: vi.fn(),
    allNotices: vi.fn(),
    deleteNotice: vi.fn(),
    bulk: vi.fn(),
  },
}));

const card = (id, name, extra = {}) => ({
  id, name, full_name: `me/${name}`, html_url: `https://x/${name}`, description: '',
  private: false, archived: false, fork: false, language: 'JS',
  pushed_at: '2026-06-01T00:00:00.000Z', checkedAgeDays: 0, dueInDays: 7,
  needsCheckToday: false, column: 'day-0', position: id, tags: [], priority: null,
  priority_set_at: null, checked_at: null,
  ...extra,
});

const payload = {
  repos: [card(1, 'alpha'), card(2, 'beta')],
  cacheReady: true, syncing: false, defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z', owners: [],
  sourceWarnings: [], tokenPresent: true, lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('toast + undo for ignore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.setIgnored.mockResolvedValue({ ok: true });
    api.bulk.mockResolvedValue({ ok: true, count: 2 });
  });

  it('shows an undo toast after ignoring a repo from the card menu', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open repository settings' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ignore repo' }));

    expect(await screen.findByText('Ignored alpha')).toBeInTheDocument();
    await waitFor(() => expect(api.setIgnored).toHaveBeenCalledWith(1, true));

    // Undo unignores it.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(api.setIgnored).toHaveBeenCalledWith(1, false));
  });

  it('offers undo after a bulk ignore and restores every repo', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select alpha' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select beta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }));

    expect(await screen.findByText('2 repos ignored')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(api.bulk).toHaveBeenCalledWith('unignore', expect.arrayContaining([1, 2]));
    });
  });

  it('dismisses the toast with the close button', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Open repository settings' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ignore repo' }));

    await screen.findByText('Ignored alpha');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Ignored alpha')).not.toBeInTheDocument();
  });
});

describe('toast + undo for clear-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue({
      ...payload,
      repos: [
        card(1, 'alpha', {
          priority_set_at: '2026-05-20T00:00:00.000Z',
          checked_at: '2026-05-20T08:00:00.000Z',
        }),
        card(2, 'beta'),
      ],
    });
    api.clearSchedule.mockResolvedValue({ ok: true });
    api.restoreState.mockResolvedValue({ ok: true });
  });

  it('shows "Check cleared" toast and undo calls restoreState with the snapshot', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open repository settings' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear check date' }));

    expect(await screen.findByText('Check cleared')).toBeInTheDocument();
    await waitFor(() => expect(api.clearSchedule).toHaveBeenCalledWith(1));

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(api.restoreState).toHaveBeenCalledWith(
        1,
        '2026-05-20T00:00:00.000Z',
        '2026-05-20T08:00:00.000Z'
      )
    );
  });
});

describe('toast + undo for notice deletion', () => {
  const notice = { id: 42, repo_id: 1, full_name: 'me/alpha', body: 'my note', created_at: '2026-04-01T00:00:00.000Z' };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.allNotices
      .mockResolvedValueOnce({ notices: [notice] })
      .mockResolvedValue({ notices: [] });
    api.deleteNotice.mockResolvedValue({ ok: true });
    api.addNotice.mockResolvedValue({ ok: true, id: 99 });
  });

  it('shows "Notice deleted" toast and undo re-posts with original created_at', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getByRole('button', { name: 'notices' }));
    expect(await screen.findByText('my note')).toBeInTheDocument();

    // Two-step delete: arm, then confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Delete notice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Notice deleted')).toBeInTheDocument();
    await waitFor(() => expect(api.deleteNotice).toHaveBeenCalledWith(42));

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(api.addNotice).toHaveBeenCalledWith(1, 'my note', '2026-04-01T00:00:00.000Z')
    );
  });
});
