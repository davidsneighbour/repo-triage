import { render, screen, act } from '@testing-library/react';
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
    snooze: vi.fn(),
    reorder: vi.fn(),
    getPrefs: vi.fn(),
    putPrefs: vi.fn(),
  },
}));

const card = (over) => ({
  id: 1, name: 'r', full_name: 'me/r', html_url: 'https://x/r', description: '',
  private: false, archived: false, fork: false, language: 'JS',
  pushed_at: '2026-06-01T00:00:00.000Z', checkedAgeDays: 0, dueInDays: 7,
  needsCheckToday: false, column: 'day-0', position: 0, boardOffset: 0, ...over,
});

const payload = (repos) => ({
  repos,
  cacheReady: true,
  syncing: false,
  defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z',
  owners: [],
  sourceWarnings: [],
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
});

describe('server prefs hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload([card({ id: 1, name: 'r', needsCheckToday: true })]));
    api.putPrefs.mockResolvedValue({ ok: true });
  });

  it('calls getPrefs on mount', async () => {
    api.getPrefs.mockResolvedValue({ prefs: null });

    await act(async () => { render(<App />); });

    expect(api.getPrefs).toHaveBeenCalledTimes(1);
  });

  it('calls putPrefs after getPrefs resolves (even with null prefs)', async () => {
    api.getPrefs.mockResolvedValue({ prefs: null });

    await act(async () => { render(<App />); });

    expect(api.putPrefs).toHaveBeenCalledTimes(1);
    const written = api.putPrefs.mock.calls[0][0];
    expect(written).toHaveProperty('density');
    expect(written).toHaveProperty('sort');
    expect(written).toHaveProperty('view');
    expect(written).toHaveProperty('groupBy');
    expect(written).toHaveProperty('fields');
    expect(written).toHaveProperty('filters');
    expect(written).toHaveProperty('showIgnored');
  });

  it('hydrates density from server prefs, overriding localStorage', async () => {
    // Set a different value in localStorage to confirm server wins.
    window.localStorage.setItem('repo-triage-density', 'comfortable');
    api.getPrefs.mockResolvedValue({ prefs: { density: 'compact' } });

    await act(async () => { render(<App />); });

    // The putPrefs write-back should carry the server-hydrated value.
    const written = api.putPrefs.mock.calls[0][0];
    expect(written.density).toBe('compact');
  });

  it('does NOT call putPrefs before getPrefs resolves', async () => {
    let resolvePrefs;
    api.getPrefs.mockReturnValue(new Promise((res) => { resolvePrefs = res; }));

    render(<App />);
    // Tick microtasks but do not resolve the getPrefs promise yet.
    await act(async () => {});

    expect(api.putPrefs).not.toHaveBeenCalled();

    // Now resolve — putPrefs should fire.
    await act(async () => { resolvePrefs({ prefs: null }); });
    expect(api.putPrefs).toHaveBeenCalledTimes(1);
  });

  it('calls putPrefs even when getPrefs rejects', async () => {
    api.getPrefs.mockRejectedValue(new Error('network'));

    await act(async () => { render(<App />); });

    expect(api.putPrefs).toHaveBeenCalledTimes(1);
  });
});
