import { render, screen } from '@testing-library/react';
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
  repos: [],
  cacheReady: true,
  defaultInactivityDays: 7,
  lastFetch: '2026-06-03T00:00:00.000Z',
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

// Regression guard for #82: the desktop toolbar rows must wrap whole
// buttons onto new lines at narrow widths, never shrink individual
// buttons so their label text wraps onto two lines.
describe('Desktop toolbar layout wraps as whole rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
  });

  it('wraps the header action-button group instead of shrinking it', () => {
    render(<App />);

    const headerGroup = screen.getByRole('button', { name: /sync GitHub/i }).closest('div');
    expect(headerGroup.className).toContain('flex-wrap');
  });

  it('wraps the filter-pills row instead of shrinking it', () => {
    render(<App />);

    const filterPillsGroup = screen.getByRole('checkbox', { name: 'own' }).closest('div.border-l');
    expect(filterPillsGroup.className).toContain('flex-wrap');
  });

  it('wraps the option-controls row instead of shrinking it', () => {
    render(<App />);

    const optionControlsGroup = screen.getByRole('button', { name: /reports/i }).closest('div.border-l');
    expect(optionControlsGroup.className).toContain('flex-wrap');
  });
});
