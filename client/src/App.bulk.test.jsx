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
  },
}));

const card = (id, name) => ({
  id, name, full_name: `me/${name}`, html_url: `https://x/${name}`, description: '',
  private: false, archived: false, fork: false, language: 'JS',
  pushed_at: '2026-06-01T00:00:00.000Z', checkedAgeDays: 0, dueInDays: 7,
  needsCheckToday: false, column: 'day-0', position: id, tags: [], priority: null,
});

const payload = {
  repos: [card(1, 'alpha'), card(2, 'beta')],
  cacheReady: true, syncing: false, defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z', username: null, owners: [],
  sourceWarnings: [], tokenPresent: true, lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('multi-select bulk actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.setIgnored.mockResolvedValue({ ok: true });
    api.setChecked.mockResolvedValue({ ok: true });
    api.addTag.mockResolvedValue({ ok: true });
  });

  const selectBoth = async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select alpha' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select beta' }));
  };

  it('shows the bulk bar with a count once repos are selected', async () => {
    await selectBoth();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('bulk-ignores every selected repo and clears the selection', async () => {
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }));

    await waitFor(() => expect(api.setIgnored).toHaveBeenCalledTimes(2));
    expect(api.setIgnored).toHaveBeenCalledWith(1, true);
    expect(api.setIgnored).toHaveBeenCalledWith(2, true);
    // Selection clears → bulk bar disappears.
    await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument());
  });

  it('bulk "Checked now" calls setChecked(id, 0) for each', async () => {
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Checked now' }));
    await waitFor(() => expect(api.setChecked).toHaveBeenCalledTimes(2));
    expect(api.setChecked).toHaveBeenCalledWith(1, 0);
    expect(api.setChecked).toHaveBeenCalledWith(2, 0);
  });

  it('moves the selection to any chosen day column via the dropdown', async () => {
    await selectBoth();
    // "Today" (day-0) targets the full review age; "Tomorrow" (day-1) one less.
    fireEvent.change(screen.getByRole('combobox', { name: 'Move selected to column' }), { target: { value: '6' } });
    await waitFor(() => expect(api.setChecked).toHaveBeenCalledTimes(2));
    expect(api.setChecked).toHaveBeenCalledWith(1, 6);
    expect(api.setChecked).toHaveBeenCalledWith(2, 6);
  });

  it('bulk-tags every selected repo', async () => {
    await selectBoth();
    fireEvent.change(screen.getByLabelText('Bulk tag'), { target: { value: 'sweep' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    await waitFor(() => expect(api.addTag).toHaveBeenCalledTimes(2));
    expect(api.addTag).toHaveBeenCalledWith(1, 'sweep');
    expect(api.addTag).toHaveBeenCalledWith(2, 'sweep');
  });

  it('selects every visible repo in a column via the column "select all"', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    // Both alpha and beta live in the Today column.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all in Today' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    // Toggling it again clears the selection.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all in Today' }));
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  });

  it('Deselect clears the selection without calling the API', async () => {
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Deselect' }));
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
    expect(api.setIgnored).not.toHaveBeenCalled();
  });

  it('submits a bulk tag on Enter and ignores an empty tag', async () => {
    await selectBoth();
    const input = screen.getByLabelText('Bulk tag');

    // Empty Enter is a no-op.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.addTag).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'ci' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.addTag).toHaveBeenCalledWith(1, 'ci'));
  });

  it('prunes selected ids that disappear after a refresh', async () => {
    await selectBoth();
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Next load returns only alpha; beta should drop out of the selection.
    api.refresh.mockResolvedValue({ ok: true });
    api.list.mockResolvedValue({ ...payload, repos: [card(1, 'alpha')] });
    fireEvent.click(screen.getByRole('button', { name: /sync GitHub/i }));

    await waitFor(() => expect(screen.getByText('1 selected')).toBeInTheDocument());
  });
});
