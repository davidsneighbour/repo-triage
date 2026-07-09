import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      name: 'help-repo',
      full_name: 'user/help-repo',
      html_url: 'https://example.com/help-repo',
      description: 'help test repo',
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

describe('App help dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(
      'repo-triage-board-cache-v1',
      JSON.stringify({ savedAt: '2026-06-03T00:00:00.000Z', payload })
    );
    api.list.mockResolvedValue(payload);
  });

  it('opens help with F1 and closes with Escape', async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 'F1' });
    expect(await screen.findByRole('heading', { name: 'Help' })).toBeInTheDocument();
    // Heading text mirrors the markdown source in help.md.
    expect(await screen.findByText('Repo·triage — user guide')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Help' })).not.toBeInTheDocument();
    });
  });

  it('documents the major features and the CLI companion', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open help' }));

    // Wait for the guide to mount, then assert the major sections are present.
    await screen.findByText('Repo·triage — user guide');
    expect(screen.getByText('Triage priority')).toBeInTheDocument();
    expect(screen.getByText(/CLI companion/)).toBeInTheDocument();
    expect(screen.getByText('Configuration reference')).toBeInTheDocument();
    // The CLI command list and the configuration reference render as tables.
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(2);
  });

  it('renders the pre-built flow diagram SVG without any mermaid fallback', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open help' }));

    const diagram = await screen.findByRole('img', { name: 'Repo.triage data-loading flow diagram' });
    expect(diagram.querySelector('svg')).toBeTruthy();
    expect(
      screen.queryByText('Unable to render Mermaid diagram. Markdown help is still available.')
    ).not.toBeInTheDocument();
  });
});
