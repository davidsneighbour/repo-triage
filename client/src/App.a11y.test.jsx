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
    setIgnored: vi.fn(),
    addNotice: vi.fn(),
    addTag: vi.fn(),
    removeTag: vi.fn(),
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

describe('dialog accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.setChecked.mockResolvedValue({ ok: true });
  });

  it('help is a labelled modal that traps then restores focus', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    const trigger = screen.getByRole('button', { name: 'Open help' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'help-dialog-title');
    // focus moved into the dialog (onto its first focusable: the close button)
    expect(dialog).toContainElement(document.activeElement);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // focus restored to the trigger
    expect(trigger).toHaveFocus();
  });

  it('card menu popover restores focus to its trigger on Escape', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'alpha' });

    const trigger = screen.getByRole('button', { name: 'Open repository settings' });
    trigger.focus();
    fireEvent.click(trigger);

    const menu = await screen.findByRole('dialog', { name: /Settings for alpha/ });
    expect(menu).toContainElement(document.activeElement);

    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
