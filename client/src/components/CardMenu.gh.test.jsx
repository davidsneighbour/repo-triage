import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardMenu } from './CardMenu.jsx';

const anchor = { current: document.createElement('button') };
const noop = () => {};

const makeHandlers = (overrides = {}) => ({
  onSetChecked: noop, onClearCheck: noop, onSetPriority: noop, onSetInactivity: noop,
  onSetIgnored: noop, onAddNotice: noop, onViewNotices: noop, onAddTag: noop,
  onRemoveTag: noop, onAddFlag: noop, onRemoveFlag: noop, onClose: noop,
  defaultInactivity: 7,
  ...overrides,
});

const baseRepo = {
  id: 1, name: 'alpha', full_name: 'me/alpha',
  html_url: 'https://github.com/me/alpha',
  tags: [], topics: [], flags: [],
  priority: null, ignored: false, notice_count: 0, inactivity_days: null,
};

describe('CardMenu GitHub actions — PR list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows PR button when onGhPrs is provided', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhPrs: vi.fn() })} />);
    expect(screen.getByRole('button', { name: /List open PRs/i })).toBeInTheDocument();
  });

  it('fetches and displays PR list on click', async () => {
    const onGhPrs = vi.fn().mockResolvedValue({
      prs: [{ number: 7, title: 'Fix bug', url: 'https://github.com/me/alpha/pull/7' }],
    });
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhPrs })} />);

    fireEvent.click(screen.getByRole('button', { name: /List open PRs/i }));

    await waitFor(() => expect(screen.getByText('#7 Fix bug')).toBeInTheDocument());
    expect(onGhPrs).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: /Hide PRs/i })).toBeInTheDocument();
  });

  it('shows "No open PRs" when list is empty', async () => {
    const onGhPrs = vi.fn().mockResolvedValue({ prs: [] });
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhPrs })} />);
    fireEvent.click(screen.getByRole('button', { name: /List open PRs/i }));
    await waitFor(() => expect(screen.getByText('No open PRs')).toBeInTheDocument());
  });

  it('shows error alert when onGhPrs rejects', async () => {
    const onGhPrs = vi.fn().mockRejectedValue(new Error('gh not found'));
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhPrs })} />);
    fireEvent.click(screen.getByRole('button', { name: /List open PRs/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/gh failed/));
  });

  it('collapses the PR list on a second click', async () => {
    const onGhPrs = vi.fn().mockResolvedValue({ prs: [] });
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhPrs })} />);
    fireEvent.click(screen.getByRole('button', { name: /List open PRs/i }));
    await waitFor(() => screen.getByText('No open PRs'));
    fireEvent.click(screen.getByRole('button', { name: /Hide PRs/i }));
    expect(screen.queryByText('No open PRs')).not.toBeInTheDocument();
  });
});

describe('CardMenu GitHub actions — browse issues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Browse issues" button when onViewIssues is provided', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onViewIssues: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Browse issues' })).toBeInTheDocument();
  });

  it('does not show "Browse issues" when onViewIssues is absent', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers()} />);
    expect(screen.queryByRole('button', { name: 'Browse issues' })).not.toBeInTheDocument();
  });

  it('calls onViewIssues with the repo id and closes the menu', () => {
    const onViewIssues = vi.fn();
    const onClose = vi.fn();
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onViewIssues, onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse issues' }));
    expect(onViewIssues).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CardMenu GitHub actions — issue creation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "New issue…" button when onGhCreateIssue is provided', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhCreateIssue: vi.fn() })} />);
    expect(screen.getByRole('button', { name: /New issue/i })).toBeInTheDocument();
  });

  it('clicking "New issue…" shows the issue form', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhCreateIssue: vi.fn() })} />);
    fireEvent.click(screen.getByRole('button', { name: /New issue/i }));
    expect(screen.getByRole('textbox', { name: 'Issue title' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Issue body' })).toBeInTheDocument();
  });

  it('"Cancel" on form returns to initial state', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhCreateIssue: vi.fn() })} />);
    fireEvent.click(screen.getByRole('button', { name: /New issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(screen.getByRole('button', { name: /New issue/i })).toBeInTheDocument();
  });

  it('"Create issue" button is disabled when title is empty', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhCreateIssue: vi.fn() })} />);
    fireEvent.click(screen.getByRole('button', { name: /New issue/i }));
    expect(screen.getByRole('button', { name: /Create issue/i })).toBeDisabled();
  });

  it('typing a title and clicking "Create issue" advances to confirm step', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhCreateIssue: vi.fn() })} />);
    fireEvent.click(screen.getByRole('button', { name: /New issue/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Issue title' }), { target: { value: 'My bug' } });
    fireEvent.click(screen.getByRole('button', { name: /Create issue/i }));
    expect(screen.getByText(/Create issue on GitHub\?/i)).toBeInTheDocument();
  });

  it('"Cancel" on confirm step returns to form', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhCreateIssue: vi.fn() })} />);
    fireEvent.click(screen.getByRole('button', { name: /New issue/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Issue title' }), { target: { value: 'My bug' } });
    fireEvent.click(screen.getByRole('button', { name: /Create issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(screen.getByRole('textbox', { name: 'Issue title' })).toBeInTheDocument();
  });

  it('"Yes, create" calls onGhCreateIssue and shows success link', async () => {
    const onGhCreateIssue = vi.fn().mockResolvedValue({
      url: 'https://github.com/me/alpha/issues/42', number: 42,
    });
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhCreateIssue })} />);
    fireEvent.click(screen.getByRole('button', { name: /New issue/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Issue title' }), { target: { value: 'My bug' } });
    fireEvent.click(screen.getByRole('button', { name: /Create issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, create/i }));

    await waitFor(() => expect(screen.getByText(/Issue #42 created/)).toBeInTheDocument());
    expect(onGhCreateIssue).toHaveBeenCalledWith(1, 'My bug', '');
  });

  it('"Yes, create" shows error alert when onGhCreateIssue rejects', async () => {
    const onGhCreateIssue = vi.fn().mockRejectedValue(new Error('gh failed'));
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers({ onGhCreateIssue })} />);
    fireEvent.click(screen.getByRole('button', { name: /New issue/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Issue title' }), { target: { value: 'My bug' } });
    fireEvent.click(screen.getByRole('button', { name: /Create issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, create/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/gh failed/));
  });
});
