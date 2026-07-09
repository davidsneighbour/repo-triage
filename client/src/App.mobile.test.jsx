import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { api } from './api.js';
import { setMobileViewport, setDesktopViewport } from './test/viewport.js';

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

describe('mobile board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setMobileViewport();
  });

  it('renders a single column with a day picker (today active by default)', async () => {
    api.list.mockResolvedValue(payload([
      card({ id: 1, name: 'due-now', column: 'day-0', needsCheckToday: true, dueInDays: 0 }),
      card({ id: 2, name: 'later', column: 'day-3', dueInDays: 3 }),
    ]));

    render(<App />);
    await screen.findByRole('button', { name: /Choose day/ });

    // Only the active (Today) column is shown — the day-3 repo is not.
    expect(screen.getByRole('link', { name: 'due-now' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'later' })).not.toBeInTheDocument();

    // Exactly one column group is rendered (single-column board).
    const board = screen.getByRole('group', { name: 'Repository board' });
    const columnGroups = within(board).getAllByRole('group', { name: /column,/ });
    expect(columnGroups).toHaveLength(1);
    expect(columnGroups[0]).toHaveAccessibleName(/Today column/);
  });

  it('switches the visible column via the day picker', async () => {
    api.list.mockResolvedValue(payload([
      card({ id: 1, name: 'due-now', column: 'day-0', needsCheckToday: true }),
      card({ id: 2, name: 'later', column: 'day-3', dueInDays: 3 }),
    ]));

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Choose day/ }));

    const dialog = screen.getByRole('dialog', { name: 'Choose day' });
    // The dropdown lists all 7 day columns.
    expect(within(dialog).getAllByRole('button').length).toBe(7);

    // Pick the column holding the day-3 repo ("In 3 days", weekday subtitle).
    fireEvent.click(within(dialog).getByRole('button', { name: /In 3 days/ }));

    expect(screen.getByRole('link', { name: 'later' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'due-now' })).not.toBeInTheDocument();
  });

  it('does not render the desktop multi-column scroll layout', async () => {
    api.list.mockResolvedValue(payload([card({ id: 1, name: 'due-now', needsCheckToday: true })]));

    render(<App />);
    await screen.findByRole('button', { name: /Choose day/ });

    const board = screen.getByRole('group', { name: 'Repository board' });
    // Desktop shows every day column at once; mobile shows one.
    expect(within(board).getAllByRole('group', { name: /column,/ })).toHaveLength(1);
  });
});

describe('mobile move sheet (snooze)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setMobileViewport();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.snooze.mockResolvedValue({});
  });
  afterEach(() => vi.useRealTimers());

  it('long-press → "mark done for N days" calls snooze endpoint with N', async () => {
    api.list.mockResolvedValue(payload([card({ id: 1, name: 'widget', description: 'a thing', needsCheckToday: true })]));

    render(<App />);
    await screen.findByRole('button', { name: /Choose day/ });
    const cardBody = screen.getByText('a thing');

    fireEvent.pointerDown(cardBody, { clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));

    fireEvent.change(screen.getByLabelText('Mark done for (days)'), { target: { value: '20' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    });

    expect(api.snooze).toHaveBeenCalledWith(1, 20);
    expect(api.setChecked).not.toHaveBeenCalled();
    expect(api.setInactivity).not.toHaveBeenCalled();
  });
});

describe('mobile toolbar (collapsed into an action sheet)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setMobileViewport();
  });

  it('hides the secondary controls until the overflow sheet is opened', async () => {
    api.list.mockResolvedValue(payload([card({ id: 1, name: 'r', needsCheckToday: true })]));

    render(<App />);
    await screen.findByRole('button', { name: 'More filters and options' });

    // Collapsed: group-by / sort / reports / notices not in the DOM yet.
    expect(screen.queryByLabelText('Group board by')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reports/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More filters and options' }));

    const sheet = screen.getByRole('dialog', { name: 'Filters & options' });
    expect(within(sheet).getByLabelText('Group board by')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Sort cards within columns')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /reports/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /notices/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /show ignored/ })).toBeInTheDocument();
    // Inclusive filter pills are present too.
    expect(within(sheet).getByText('own')).toBeInTheDocument();
  });

  it('keeps search inline (not behind the sheet)', async () => {
    api.list.mockResolvedValue(payload([card({ id: 1, name: 'r', needsCheckToday: true })]));
    render(<App />);
    expect(await screen.findByLabelText('Search repositories')).toBeInTheDocument();
  });
});

describe('mobile bulk bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setMobileViewport();
  });

  it('pins to the bottom edge when repos are selected', async () => {
    api.list.mockResolvedValue(payload([card({ id: 1, name: 'r', needsCheckToday: true })]));
    render(<App />);
    await screen.findByRole('link', { name: 'r' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select r' }));
    const region = screen.getByRole('region', { name: 'Bulk actions' });
    expect(region.className).toMatch(/bottom-0/);
    expect(region.className).toMatch(/fixed/);
  });
});

describe('desktop board (above the breakpoint)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setDesktopViewport();
  });

  it('renders all day columns and no day picker', async () => {
    api.list.mockResolvedValue(payload([card({ id: 1, name: 'due-now', needsCheckToday: true })]));

    render(<App />);
    await screen.findByRole('link', { name: 'due-now' });

    expect(screen.queryByRole('button', { name: /Choose day/ })).not.toBeInTheDocument();
    const board = screen.getByRole('group', { name: 'Repository board' });
    // 7-day review cycle → 7 columns visible at once on desktop.
    expect(within(board).getAllByRole('group', { name: /column,/ }).length).toBe(7);
  });
});
