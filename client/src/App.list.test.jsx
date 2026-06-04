import { fireEvent, render, screen, within } from '@testing-library/react';
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
  },
}));

const card = (id, name, over = {}) => ({
  id, name, full_name: `me/${name}`, html_url: `https://x/${name}`, description: '',
  private: false, archived: false, fork: false, language: 'JS',
  pushed_at: '2026-06-01T00:00:00.000Z', checkedAgeDays: 0, dueInDays: 7,
  needsCheckToday: false, column: 'day-0', position: id, tags: [], priority: null, ...over,
});

const payload = (repos) => ({
  repos, cacheReady: true, syncing: false, defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z', username: null, owners: [],
  sourceWarnings: [], tokenPresent: true, lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
});

describe('list/table view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload([
      card(1, 'banana', { stargazers_count: 5 }),
      card(2, 'apple', { stargazers_count: 9 }),
    ]));
  });

  it('switches to a table and sorts by a clicked column header, persisting the view', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'banana' });

    fireEvent.click(screen.getByRole('button', { name: 'board' }));
    expect(window.localStorage.getItem('repo-triage-view')).toBe('list');

    // A table renders both repos as rows; default sort is by name ascending.
    const table = screen.getByRole('table');
    let names = within(table).getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(['apple', 'banana']);

    // Sorting by stars descending puts the 9-star repo first.
    fireEvent.click(screen.getByRole('button', { name: 'Sort by ★' }));
    names = within(screen.getByRole('table')).getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(['apple', 'banana']); // apple has 9 stars

    // Clicking it again flips to ascending.
    fireEvent.click(screen.getByRole('button', { name: 'Sort by ★' }));
    names = within(screen.getByRole('table')).getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(['banana', 'apple']);
  });

  it('opens the shared card menu from a table row', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'banana' });
    fireEvent.click(screen.getByRole('button', { name: 'board' }));

    fireEvent.click(screen.getByRole('button', { name: 'Settings for banana' }));
    // The CardMenu (priority controls etc.) appears.
    expect(await screen.findByRole('button', { name: 'P1' })).toBeInTheDocument();
  });

  it('renders owner, priority, tags, ignored and due/checked cells', async () => {
    window.localStorage.setItem('repo-triage-view', 'list');
    api.list.mockResolvedValue(payload([
      card(1, 'one', { owner: 'me', priority: 1, tags: ['infra'], needsCheckToday: true, checkedAgeDays: null }),
      card(2, 'two', { owner: 'dnbhq', priority: null, ignored: true, checkedAgeDays: 5 }),
    ]));
    // Reveal the ignored repo so both rows render.
    window.localStorage.setItem('repo-triage-show-ignored', 'true');

    render(<App />);
    const table = await screen.findByRole('table');

    // Owner column appears once the board mixes owners.
    expect(screen.getByRole('button', { name: 'Sort by Owner' })).toBeInTheDocument();
    expect(within(table).getByText('me')).toBeInTheDocument();
    expect(within(table).getByText('P1')).toBeInTheDocument();
    expect(within(table).getByText('#infra')).toBeInTheDocument();
    expect(within(table).getByText('(ignored)')).toBeInTheDocument();
    // needsCheckToday → "today" in the Due column; null checked age → "—".
    expect(within(table).getAllByText('today').length).toBeGreaterThan(0);
    expect(within(table).getByText('—')).toBeInTheDocument();

    // Sorting a non-numeric column defaults to ascending.
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Owner' }));
    const names = within(screen.getByRole('table')).getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(['two', 'one']); // dnbhq before me
  });

  it('shows an empty state when no repositories match', async () => {
    window.localStorage.setItem('repo-triage-view', 'list');
    api.list.mockResolvedValue(payload([card(1, 'hidden', { ignored: true })]));

    render(<App />);
    expect(await screen.findByText('no repositories match')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
