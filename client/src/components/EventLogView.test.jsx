import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventLogView } from './EventLogView.jsx';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    allActivity: vi.fn(),
  },
}));

const noop = () => {};

const entry = (over = {}) => ({
  id: 1, repo_id: 1, full_name: 'me/alpha', action: 'check', detail: { daysAgo: 3 },
  created_at: '2026-07-01T00:00:00Z',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EventLogView — load', () => {
  it('loads and lists activity across repos without triggering a sync', async () => {
    api.allActivity.mockResolvedValue({ activity: [entry()] });

    render(<EventLogView onClose={noop} />);

    expect(await screen.findByText('me/alpha')).toBeInTheDocument();
    expect(screen.getByText('Checked (3d ago)')).toBeInTheDocument();
    expect(api.allActivity).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there is no activity', async () => {
    api.allActivity.mockResolvedValue({ activity: [] });

    render(<EventLogView onClose={noop} />);

    expect(await screen.findByText('no activity yet')).toBeInTheDocument();
  });

  it('shows the event count across repos in the header', async () => {
    api.allActivity.mockResolvedValue({
      activity: [entry({ id: 1, repo_id: 1 }), entry({ id: 2, repo_id: 2, full_name: 'me/beta' })],
    });

    render(<EventLogView onClose={noop} />);

    expect(await screen.findByText('2 events across all repos')).toBeInTheDocument();
  });

  it('is not modal — role is region, not dialog', async () => {
    api.allActivity.mockResolvedValue({ activity: [] });

    render(<EventLogView onClose={noop} />);

    expect(await screen.findByRole('region', { name: 'Event log' })).toBeInTheDocument();
  });
});

describe('EventLogView — sorting', () => {
  const rows = [
    entry({ id: 1, repo_id: 1, full_name: 'me/beta', action: 'check', created_at: '2026-07-01T00:00:00Z' }),
    entry({ id: 2, repo_id: 2, full_name: 'me/alpha', action: 'priority', detail: { priority: 1 }, created_at: '2026-07-03T00:00:00Z' }),
  ];

  beforeEach(() => {
    api.allActivity.mockResolvedValue({ activity: rows });
  });

  const bodyRepoCells = () => screen.getAllByRole('row').slice(1).map((r) => r.querySelectorAll('td')[0].textContent);

  it('defaults to newest-first by timestamp', async () => {
    render(<EventLogView onClose={noop} />);
    await screen.findByText('me/alpha');

    expect(bodyRepoCells()).toEqual(['me/alpha', 'me/beta']);
  });

  it('sorts by repo name when the repo header is clicked', async () => {
    render(<EventLogView onClose={noop} />);
    await screen.findByText('me/alpha');

    fireEvent.click(screen.getByRole('button', { name: 'Sort by repo' }));

    expect(bodyRepoCells()).toEqual(['me/alpha', 'me/beta']);
  });

  it('reverses direction on a second click of the same column', async () => {
    render(<EventLogView onClose={noop} />);
    await screen.findByText('me/alpha');

    fireEvent.click(screen.getByRole('button', { name: 'Sort by timestamp' }));

    expect(bodyRepoCells()).toEqual(['me/beta', 'me/alpha']);
  });
});
