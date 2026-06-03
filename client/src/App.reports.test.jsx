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
    reportKinds: vi.fn(),
    report: vi.fn(),
  },
}));

const payload = {
  repos: [
    {
      id: 1, name: 'alpha', full_name: 'me/alpha', html_url: 'https://x/alpha', description: '',
      private: false, archived: false, fork: false, language: 'JS', pushed_at: '2026-06-01T00:00:00.000Z',
      checkedAgeDays: 0, dueInDays: 7, needsCheckToday: false, column: 'day-0', position: 0,
    },
  ],
  cacheReady: true, syncing: false, defaultInactivityDays: 7, lastFetch: '2026-06-03T00:00:00.000Z',
  username: null, owners: [], sourceWarnings: [], tokenPresent: true, lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe('Reports dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.reportKinds.mockResolvedValue({ kinds: ['summary', 'due'] });
    api.report.mockImplementation((kind, opts) => {
      // Non-json formats come back as text in the real api wrapper.
      if (opts?.format && opts.format !== 'json') return Promise.resolve('## Summary\n\n| metric | value |\n');
      return Promise.resolve({
        kind,
        title: kind === 'summary' ? 'Summary' : 'Due today',
        columns: ['metric', 'value'],
        rows: [['total repos', 2]],
      });
    });
  });

  it('opens from the toolbar and renders a report table', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    fireEvent.click(screen.getByRole('button', { name: 'reports' }));

    expect(await screen.findByText('total repos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    await waitFor(() => expect(api.report).toHaveBeenCalledWith('summary', expect.any(Object)));
  });

  it('switches kind and renders markdown with a copy button', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    await screen.findByText('total repos');

    fireEvent.click(screen.getByRole('button', { name: 'due today' }));
    await waitFor(() => expect(api.report).toHaveBeenCalledWith('due', expect.any(Object)));

    fireEvent.click(screen.getByRole('button', { name: 'markdown' }));
    expect(await screen.findByText(/## Summary/)).toBeInTheDocument();

    // copy (clipboard may be unavailable in jsdom — the handler swallows it) and csv view
    fireEvent.click(screen.getByRole('button', { name: 'copy' }));
    fireEvent.click(screen.getByRole('button', { name: 'csv' }));
    await waitFor(() => expect(api.report).toHaveBeenCalledWith('due', expect.objectContaining({ format: 'csv' })));
  });

  it('shows an empty state when a report fails or has no rows', async () => {
    api.report.mockReset();
    api.report.mockRejectedValue(new Error('boom'));

    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    fireEvent.click(screen.getByRole('button', { name: 'reports' }));

    expect(await screen.findByText('no matching repositories')).toBeInTheDocument();
  });

  it('tolerates a failed markdown fetch', async () => {
    api.report.mockReset();
    api.report.mockImplementation((kind, opts) => {
      if (opts?.format === 'md') return Promise.reject(new Error('boom'));
      return Promise.resolve({ kind, title: 'Summary', columns: ['m', 'v'], rows: [['x', 1]] });
    });

    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });
    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    await screen.findByText('x');

    fireEvent.click(screen.getByRole('button', { name: 'markdown' }));
    await waitFor(() => expect(api.report).toHaveBeenCalledWith('summary', expect.objectContaining({ format: 'md' })));
  });
});
