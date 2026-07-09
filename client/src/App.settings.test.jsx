import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { api } from './api.js';

vi.mock('./api.js', () => ({
  api: {
    list: vi.fn(),
    getTags: vi.fn(),
    refresh: vi.fn(),
    getPrefs: vi.fn(),
    putPrefs: vi.fn(),
    getSettings: vi.fn(),
    getTagRules: vi.fn(),
    getLastExport: vi.fn(),
    putSettings: vi.fn(),
  },
}));

const payload = (repos = []) => ({
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

const settingsResp = {
  settings: { defaultInactivityDays: 14, syncIntervalMinutes: 30, githubOwners: '' },
  defaults: { defaultInactivityDays: 7, syncIntervalMinutes: 60, githubOwners: '' },
};

describe('App settings dialog integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload());
    api.getPrefs.mockResolvedValue({ prefs: null });
    api.putPrefs.mockResolvedValue({ ok: true });
    api.getSettings.mockResolvedValue(settingsResp);
    api.getTagRules.mockResolvedValue({ rules: [] });
    api.getLastExport.mockResolvedValue({ lastExport: null });
    api.putSettings.mockResolvedValue({ ok: true });
  });

  it('opens the settings dialog when the Settings button is clicked', async () => {
    await act(async () => { render(<App />); });
    fireEvent.click(await screen.findByRole('button', { name: 'Open settings' }));
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('saves settings and closes the dialog on submit', async () => {
    await act(async () => { render(<App />); });
    fireEvent.click(await screen.findByRole('button', { name: 'Open settings' }));
    await screen.findByRole('dialog', { name: 'Settings' });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => {
      expect(api.putSettings).toHaveBeenCalled();
      expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
    });
  });
});

describe('App filter show-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload());
    api.getPrefs.mockResolvedValue({ prefs: null });
    api.putPrefs.mockResolvedValue({ ok: true });
  });

  it('shows "show all" button when a filter is unchecked and restores all on click', async () => {
    window.localStorage.setItem(
      'repo-triage-filters',
      JSON.stringify({ showOwn: false, showForks: true, showArchived: true })
    );
    await act(async () => { render(<App />); });
    const showAllBtn = await screen.findByRole('button', { name: 'show all' });
    expect(showAllBtn).toBeInTheDocument();
    fireEvent.click(showAllBtn);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'show all' })).not.toBeInTheDocument()
    );
  });
});
