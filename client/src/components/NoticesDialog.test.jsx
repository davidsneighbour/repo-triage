import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticesDialog } from './NoticesDialog.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    allNotices: vi.fn(),
    repoNotices: vi.fn(),
    getActivity: vi.fn(),
    deleteNotice: vi.fn(),
  },
}));

const notice = { id: 7, repo_id: 1, full_name: 'me/alpha', body: 'hi there', created_at: '2026-05-01T00:00:00.000Z' };
const noop = () => {};

describe('NoticesDialog onDeleted callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.allNotices.mockResolvedValue({ notices: [notice] });
    api.deleteNotice.mockResolvedValue({ ok: true });
  });

  it('calls onDeleted with the deleted notice after confirmation', async () => {
    const onDeleted = vi.fn();
    render(<NoticesDialog scope="all" repos={[]} onClose={noop} onScopeChange={noop} onDeleted={onDeleted} />);

    expect(await screen.findByText('hi there')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete notice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteNotice).toHaveBeenCalledWith(7));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(notice));
  });

  it('does not throw when onDeleted is not provided', async () => {
    render(<NoticesDialog scope="all" repos={[]} onClose={noop} onScopeChange={noop} />);

    expect(await screen.findByText('hi there')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete notice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteNotice).toHaveBeenCalledWith(7));
    // No crash — onDeleted?.(notice) is a no-op when prop is absent.
  });
});

describe('NoticesDialog per-repo scope', () => {
  const repos = [{ id: 1, name: 'alpha', full_name: 'me/alpha' }];
  const repoNotice = { id: 11, repo_id: 1, full_name: 'me/alpha', body: 'repo notice', created_at: '2026-06-01T00:00:00.000Z' };

  beforeEach(() => {
    vi.clearAllMocks();
    api.repoNotices.mockResolvedValue({ notices: [repoNotice] });
    api.getActivity.mockResolvedValue({ activity: [] });
    api.deleteNotice.mockResolvedValue({ ok: true });
  });

  it('shows Notices and Activity tab buttons for repo scope', async () => {
    render(<NoticesDialog scope={1} repos={repos} onClose={noop} onScopeChange={noop} />);
    expect(await screen.findByRole('button', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notices' })).toBeInTheDocument();
  });

  it('calls onScopeChange with "all" when "show all repos" is clicked', async () => {
    const onScopeChange = vi.fn();
    render(<NoticesDialog scope={1} repos={repos} onClose={noop} onScopeChange={onScopeChange} />);
    await screen.findByText('repo notice');
    fireEvent.click(screen.getByRole('button', { name: /show all repos/ }));
    expect(onScopeChange).toHaveBeenCalledWith('all');
  });

  it('switches to Activity tab and shows empty activity message', async () => {
    render(<NoticesDialog scope={1} repos={repos} onClose={noop} onScopeChange={noop} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activity' }));
    expect(await screen.findByText('no activity yet')).toBeInTheDocument();
  });

  it('renders activity entries with activitySummary for various action types', async () => {
    const activity = [
      { id: 1, action: 'check', detail: { daysAgo: 3 }, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 2, action: 'snooze', detail: { days: 7 }, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 3, action: 'priority', detail: { priority: 1 }, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 4, action: 'ignore', detail: { ignored: true }, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 5, action: 'ignore', detail: { ignored: false }, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 6, action: 'tag_add', detail: { tag: 'infra' }, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 7, action: 'flag_add', detail: { flag: 'pinned' }, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 8, action: 'inactivity', detail: { days: null }, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 9, action: 'state', detail: null, created_at: '2026-06-01T00:00:00.000Z' },
      { id: 10, action: 'notice_add', detail: { body: 'x'.repeat(70) }, created_at: '2026-06-01T00:00:00.000Z' },
    ];
    api.getActivity.mockResolvedValue({ activity });
    render(<NoticesDialog scope={1} repos={repos} onClose={noop} onScopeChange={noop} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activity' }));
    expect(await screen.findByText('Checked (3d ago)')).toBeInTheDocument();
    expect(screen.getByText('Snoozed 7d')).toBeInTheDocument();
    expect(screen.getByText('Priority → 1')).toBeInTheDocument();
    expect(screen.getByText('Ignored')).toBeInTheDocument();
    expect(screen.getByText('Unignored')).toBeInTheDocument();
    expect(screen.getByText('Tag added: infra')).toBeInTheDocument();
    expect(screen.getByText('Flag added: pinned')).toBeInTheDocument();
    expect(screen.getByText('Review cadence → default')).toBeInTheDocument();
    expect(screen.getByText('State restored')).toBeInTheDocument();
    expect(screen.getByText(/Notice:.*…/)).toBeInTheDocument();
  });

  it('sort direction toggle reverses the direction indicator', async () => {
    render(<NoticesDialog scope={1} repos={repos} onClose={noop} onScopeChange={noop} />);
    await screen.findByText('repo notice');
    const toggleBtn = screen.getByRole('button', { name: 'Toggle sort direction' });
    expect(toggleBtn).toHaveTextContent('↓ desc');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('↑ asc');
  });

  it('sort by repo button activates repo sort', async () => {
    render(<NoticesDialog scope={1} repos={repos} onClose={noop} onScopeChange={noop} />);
    await screen.findByText('repo notice');
    const repoBtn = screen.getByRole('button', { name: 'repo' });
    fireEvent.click(repoBtn);
    expect(repoBtn.className).toMatch(/bg-neutral-800/);
  });

  it('cancel confirmation clears the pending delete', async () => {
    render(<NoticesDialog scope={1} repos={repos} onClose={noop} onScopeChange={noop} />);
    await screen.findByText('repo notice');
    fireEvent.click(screen.getByRole('button', { name: 'Delete notice' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel delete' }));
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
