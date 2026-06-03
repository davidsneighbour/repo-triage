import { fireEvent, render, screen } from '@testing-library/react';
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
  },
}));

const card = (id, name, extra = {}) => ({
  id,
  name,
  full_name: `user/${name}`,
  html_url: `https://example.com/${name}`,
  description: '',
  private: false,
  archived: false,
  fork: false,
  language: 'JavaScript',
  pushed_at: '2026-06-01T00:00:00.000Z',
  checkedAgeDays: 0,
  dueInDays: 7,
  needsCheckToday: false,
  column: 'day-0',
  position: id,
  ...extra,
});

const payload = {
  repos: [card(1, 'alpha-repo'), card(2, 'beta-repo')],
  cacheReady: true,
  defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z',
  username: 'user',
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('per-column filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
  });

  it('narrows only its own column and updates the count chip', async () => {
    render(<App />);

    expect(await screen.findByRole('link', { name: 'alpha-repo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'beta-repo' })).toBeInTheDocument();

    const todayFilter = screen.getByLabelText('Filter Today column');
    fireEvent.change(todayFilter, { target: { value: 'alpha' } });

    expect(screen.getByRole('link', { name: 'alpha-repo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'beta-repo' })).not.toBeInTheDocument();
    // count chip shows visible/total while filtering
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('clears the column filter via the × button', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha-repo' });

    const todayFilter = screen.getByLabelText('Filter Today column');
    fireEvent.change(todayFilter, { target: { value: 'alpha' } });
    expect(screen.queryByRole('link', { name: 'beta-repo' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear Today filter'));

    expect(todayFilter).toHaveValue('');
    expect(screen.getByRole('link', { name: 'beta-repo' })).toBeInTheDocument();
  });

  it('shows "no matches" when the column filter excludes everything', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha-repo' });

    const todayFilter = screen.getByLabelText('Filter Today column');
    fireEvent.change(todayFilter, { target: { value: 'zzz' } });

    expect(screen.queryByRole('link', { name: 'alpha-repo' })).not.toBeInTheDocument();
    expect(screen.getByText('no matches')).toBeInTheDocument();
  });
});
