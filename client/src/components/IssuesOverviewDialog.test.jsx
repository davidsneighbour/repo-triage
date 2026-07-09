import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssuesOverviewDialog } from './IssuesOverviewDialog.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    allIssues: vi.fn(),
    setIssueFlagged: vi.fn(),
  },
}));

const noop = () => {};

const issue = (over = {}) => ({
  repo_id: 1, repo_full_name: 'me/alpha', number: 1, title: 'a bug', state: 'open',
  labels: ['bug'], body: 'the details', html_url: 'https://github.com/me/alpha/issues/1',
  github_updated_at: '2026-07-01T00:00:00Z', flagged: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.setIssueFlagged.mockResolvedValue({ ok: true, flagged: true });
});

describe('IssuesOverviewDialog — load', () => {
  it('loads and lists locally stored issues without calling any sync endpoint', async () => {
    api.allIssues.mockResolvedValue({ issues: [issue()] });

    render(<IssuesOverviewDialog onClose={noop} />);

    expect(await screen.findByText(/a bug/)).toBeInTheDocument();
    expect(screen.getByText('me/alpha')).toBeInTheDocument();
    expect(api.allIssues).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there are no matching issues', async () => {
    api.allIssues.mockResolvedValue({ issues: [] });

    render(<IssuesOverviewDialog onClose={noop} />);

    expect(await screen.findByText('no matching issues')).toBeInTheDocument();
  });

  it('shows the synced-issue count across repos in the header', async () => {
    api.allIssues.mockResolvedValue({
      issues: [issue({ repo_id: 1, number: 1 }), issue({ repo_id: 2, number: 2, repo_full_name: 'me/beta' })],
    });

    render(<IssuesOverviewDialog onClose={noop} />);

    expect(await screen.findByText('2 synced issues across all repos')).toBeInTheDocument();
  });
});

describe('IssuesOverviewDialog — search, state filter, sort', () => {
  const issues = [
    issue({ repo_id: 1, repo_full_name: 'me/alpha', number: 1, title: 'fix login crash', state: 'open' }),
    issue({ repo_id: 2, repo_full_name: 'me/beta', number: 2, title: 'update docs', state: 'open' }),
    issue({ repo_id: 1, repo_full_name: 'me/alpha', number: 3, title: 'old crash report', state: 'closed' }),
  ];

  beforeEach(() => {
    api.allIssues.mockResolvedValue({ issues });
  });

  it('defaults to showing only open issues', async () => {
    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/fix login crash/);
    expect(screen.queryByText(/old crash report/)).not.toBeInTheDocument();
  });

  it('the "all" state filter reveals closed issues too', async () => {
    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/fix login crash/);
    fireEvent.click(screen.getByRole('button', { name: 'all' }));
    expect(await screen.findByText(/old crash report/)).toBeInTheDocument();
  });

  it('filters by search text', async () => {
    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/fix login crash/);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search issues' }), { target: { value: 'docs' } });
    expect(screen.queryByText(/fix login crash/)).not.toBeInTheDocument();
    expect(screen.getByText(/update docs/)).toBeInTheDocument();
  });

  it('sorts by repo, ascending puts me/alpha before me/beta', async () => {
    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/fix login crash/);
    fireEvent.click(screen.getByRole('button', { name: 'all' }));
    fireEvent.click(screen.getByRole('button', { name: 'repo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sort direction' })); // desc -> asc
    const titles = screen.getAllByText(/#\d/).map((el) => el.parentElement.textContent);
    expect(titles[0]).toMatch(/fix login crash|old crash report/); // me/alpha sorts before me/beta ascending
  });

  it('sort direction toggle reverses order', async () => {
    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/fix login crash/);
    const toggleBtn = screen.getByRole('button', { name: 'Toggle sort direction' });
    expect(toggleBtn).toHaveTextContent('↓ desc');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('↑ asc');
  });
});

describe('IssuesOverviewDialog — flagging', () => {
  it('flags an issue using its repo id and issue number', async () => {
    api.allIssues.mockResolvedValue({ issues: [issue({ repo_id: 5, number: 3, flagged: false })] });

    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/a bug/);

    fireEvent.click(screen.getByRole('button', { name: 'Flag issue #3' }));
    expect(api.setIssueFlagged).toHaveBeenCalledWith(5, 3, true);
    expect(await screen.findByRole('button', { name: 'Unflag issue #3' })).toBeInTheDocument();
  });

  it('the "flagged" filter pill shows only flagged issues', async () => {
    api.allIssues.mockResolvedValue({
      issues: [
        issue({ repo_id: 1, number: 1, title: 'unflagged issue', flagged: false }),
        issue({ repo_id: 1, number: 2, title: 'flagged issue', flagged: true }),
      ],
    });

    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/unflagged issue/);

    fireEvent.click(screen.getByRole('button', { name: 'flagged' }));
    expect(screen.queryByText(/unflagged issue/)).not.toBeInTheDocument();
    expect(screen.getByText(/flagged issue/)).toBeInTheDocument();
  });
});

describe('IssuesOverviewDialog — columns menu', () => {
  it('toggles the status column off and on', async () => {
    api.allIssues.mockResolvedValue({ issues: [issue()] });

    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/a bug/);
    // "open" also appears as the state-filter button label, so there are two matches initially.
    expect(screen.getAllByText('open')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle columns' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'status' }));
    expect(screen.getAllByText('open')).toHaveLength(1);

    fireEvent.click(screen.getByRole('checkbox', { name: 'status' }));
    expect(screen.getAllByText('open')).toHaveLength(2);
  });

  it('toggles the labels column off', async () => {
    api.allIssues.mockResolvedValue({ issues: [issue({ labels: ['bug'] })] });

    render(<IssuesOverviewDialog onClose={noop} />);
    await screen.findByText(/a bug/);
    expect(screen.getByText('bug')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle columns' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'labels' }));
    expect(screen.queryByText('bug')).not.toBeInTheDocument();
  });
});

describe('IssuesOverviewDialog — close', () => {
  it('calls onClose from the close button', async () => {
    api.allIssues.mockResolvedValue({ issues: [] });
    const onClose = vi.fn();

    render(<IssuesOverviewDialog onClose={onClose} />);
    await screen.findByText('no matching issues');

    fireEvent.click(screen.getByRole('button', { name: 'Close issues overview' }));
    expect(onClose).toHaveBeenCalled();
  });
});
