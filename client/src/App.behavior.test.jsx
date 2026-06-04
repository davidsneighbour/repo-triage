import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const payload = {
  repos: [
    {
      id: 1,
      name: 'menu-repo',
      full_name: 'user/menu-repo',
      html_url: 'https://example.com/menu-repo',
      description: 'menu test repo',
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
    },
  ],
  cacheReady: true,
  defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z',
  username: 'user',
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('App behaviour coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.setChecked.mockResolvedValue({ ok: true });
    api.setPriority.mockResolvedValue({ ok: true });
    api.clearSchedule.mockResolvedValue({ ok: true });
    api.setInactivity.mockResolvedValue({ ok: true });
  });

  it('shows loading then fetching state when cache is not ready', async () => {
    const req = deferred();
    api.list.mockReturnValueOnce(req.promise);

    render(<App />);

    expect(screen.getByText('loading...')).toBeInTheDocument();

    await act(async () => {
      req.resolve({ ...payload, repos: [], cacheReady: false });
      await req.promise;
    });

    expect(screen.getByText('fetching repositories from GitHub...')).toBeInTheDocument();
  });

  it('wires card menu actions to API wrappers', async () => {
    api.list.mockResolvedValue(payload);

    render(<App />);

    await screen.findByRole('link', { name: 'menu-repo' });

    fireEvent.click(screen.getByRole('button', { name: 'Open repository settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Checked now' }));

    await waitFor(() => {
      expect(api.setChecked).toHaveBeenCalledWith(1, 0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open repository settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move to Today' }));

    await waitFor(() => {
      expect(api.setChecked).toHaveBeenCalledWith(1, 7);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open repository settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear check date' }));

    await waitFor(() => {
      expect(api.clearSchedule).toHaveBeenCalledWith(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open repository settings' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.setInactivity).toHaveBeenCalledWith(1, 10);
    });
  });
});
