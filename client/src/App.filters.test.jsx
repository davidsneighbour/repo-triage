import { fireEvent, render, screen } from '@testing-library/react';
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
      id: 1,
      name: 'filter-repo',
      full_name: 'user/filter-repo',
      html_url: 'https://example.com/filter-repo',
      description: 'filter test repo',
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
};

describe('App filter persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(
      'repo-triage-board-cache-v1',
      JSON.stringify({ savedAt: '2026-06-03T00:00:00.000Z', payload })
    );
    api.list.mockResolvedValue(payload);
  });

  it('persists filter changes to localStorage and restores on re-render', () => {
    const { unmount } = render(<App />);

    const ownToggle = screen.getByRole('checkbox', { name: 'own' });
    expect(ownToggle).toBeChecked();

    fireEvent.click(ownToggle);

    expect(JSON.parse(window.localStorage.getItem('repo-triage-filters')).showOwn).toBe(false);

    unmount();
    render(<App />);

    expect(screen.getByRole('checkbox', { name: 'own' })).not.toBeChecked();
  });

  it('falls back to defaults when persisted value is invalid JSON', () => {
    window.localStorage.setItem('repo-triage-filters', '{not-json');

    render(<App />);

    expect(screen.getByRole('checkbox', { name: 'own' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'forks' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'archived' })).toBeChecked();
  });

  it('double-click solos a pill: turns the other two off and this one on', () => {
    render(<App />);

    const forksPill = screen.getByRole('checkbox', { name: 'forks' }).closest('label');
    fireEvent.doubleClick(forksPill);

    expect(screen.getByRole('checkbox', { name: 'own' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'forks' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'archived' })).not.toBeChecked();
    expect(JSON.parse(window.localStorage.getItem('repo-triage-filters'))).toEqual({
      showOwn: false,
      showForks: true,
      showArchived: false,
    });
  });

  it('double-tap solos a pill on touch devices', () => {
    render(<App />);

    const archivedPill = screen.getByRole('checkbox', { name: 'archived' }).closest('label');
    fireEvent.touchEnd(archivedPill);
    fireEvent.touchEnd(archivedPill);

    expect(screen.getByRole('checkbox', { name: 'own' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'forks' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'archived' })).toBeChecked();
  });

  it('does not solo on a single tap, only leaves the normal click behavior intact', () => {
    render(<App />);

    const ownPill = screen.getByRole('checkbox', { name: 'own' }).closest('label');
    fireEvent.touchEnd(ownPill);

    expect(screen.getByRole('checkbox', { name: 'own' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'forks' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'archived' })).toBeChecked();
  });
});
