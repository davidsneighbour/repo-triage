import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { api } from './api.js';

vi.mock('./api.js', () => ({
  api: {
    list: vi.fn(),
    refresh: vi.fn(),
    setPriority: vi.fn(),
    setChecked: vi.fn(),
    touch: vi.fn(),
    setInactivity: vi.fn(),
    reorder: vi.fn(),
    addTag: vi.fn(),
    removeTag: vi.fn(),
  },
}));

const card = (id, name, tags) => ({
  id, name, full_name: `me/${name}`, html_url: `https://x/${name}`, description: '',
  private: false, archived: false, fork: false, language: 'JS',
  pushed_at: '2026-06-01T00:00:00.000Z', checkedAgeDays: 0, dueInDays: 7,
  needsCheckToday: false, column: 'day-0', position: id, tags,
});

const payload = {
  repos: [card(1, 'alpha', ['infra']), card(2, 'beta', ['oss'])],
  cacheReady: true,
  syncing: false,
  defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z',
  username: null,
  owners: [],
  sourceWarnings: [],
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('tags UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.addTag.mockResolvedValue({ ok: true });
    api.removeTag.mockResolvedValue({ ok: true });
  });

  it('renders tag chips on cards', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    expect(screen.getByText('#infra')).toBeInTheDocument();
    expect(screen.getByText('#oss')).toBeInTheDocument();
  });

  it('adds a tag from the card menu', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open repository settings' })[0]);
    fireEvent.change(screen.getByLabelText('New tag'), { target: { value: 'db' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));

    await waitFor(() => expect(api.addTag).toHaveBeenCalledWith(1, 'db'));
  });

  it('filters the board by a selected tag', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getByRole('button', { name: 'Filter by tag' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /infra/i }));

    expect(screen.getByRole('link', { name: 'alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'beta' })).not.toBeInTheDocument();
  });
});
