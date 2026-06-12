import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepoCard } from './RepoCard.jsx';

const baseRepo = {
  id: 1, name: 'widget', html_url: 'https://x/widget', description: null,
  private: false, archived: false, fork: false, language: null,
  pushed_at: '2026-06-01T00:00:00.000Z', checkedAgeDays: 0, dueInDays: 7,
  needsCheckToday: false, boardOffset: 0, tags: [], flags: [],
  forks_count: 0, stargazers_count: 0, open_issues_count: 0,
};
const column = { key: 'day-0', title: 'Today', daysAgoTarget: 7, accent: 'neutral' };

const renderCard = (repoOverrides = {}, fields = {}) =>
  render(
    <RepoCard
      repo={{ ...baseRepo, ...repoOverrides }}
      column={column}
      fields={fields}
      onToggleMenu={vi.fn()}
      onDragStartCard={vi.fn()}
      onDropOnCard={vi.fn()}
      defaultInactivity={7}
    />
  );

describe('RepoCard enrichment fields', () => {
  it('shows open PR count when positive', () => {
    renderCard({ open_prs: 5 });
    expect(screen.getByTitle('5 open PRs')).toBeInTheDocument();
  });

  it('hides open PR count when zero', () => {
    renderCard({ open_prs: 0 });
    expect(screen.queryByTitle('0 open PRs')).not.toBeInTheDocument();
  });

  it('hides open PR count when null', () => {
    renderCard({ open_prs: null });
    expect(screen.queryByTitle(/open PRs/)).not.toBeInTheDocument();
  });

  it('shows latest release tag', () => {
    renderCard({ latest_release: { tag: 'v2.0.0', published_at: '2024-01-01T00:00:00Z' } });
    expect(screen.getByTitle('Latest release: v2.0.0')).toBeInTheDocument();
  });

  it('hides latest release when null', () => {
    renderCard({ latest_release: null });
    expect(screen.queryByTitle(/Latest release/)).not.toBeInTheDocument();
  });

  it('shows last commit timeAgo', () => {
    renderCard({ last_commit: { date: '2026-06-10T00:00:00Z', author: 'Bob' } });
    expect(screen.getByTitle('Last commit by Bob')).toBeInTheDocument();
  });

  it('hides last commit when null', () => {
    renderCard({ last_commit: null });
    expect(screen.queryByTitle(/Last commit/)).not.toBeInTheDocument();
  });

  it('shows CI SUCCESS status', () => {
    renderCard({ ci_status: 'SUCCESS' });
    expect(screen.getByTitle('CI: SUCCESS')).toBeInTheDocument();
  });

  it('shows CI FAILURE status', () => {
    renderCard({ ci_status: 'FAILURE' });
    expect(screen.getByTitle('CI: FAILURE')).toBeInTheDocument();
  });

  it('shows CI PENDING status', () => {
    renderCard({ ci_status: 'PENDING' });
    expect(screen.getByTitle('CI: PENDING')).toBeInTheDocument();
  });

  it('shows CI ERROR status', () => {
    renderCard({ ci_status: 'ERROR' });
    expect(screen.getByTitle('CI: ERROR')).toBeInTheDocument();
  });

  it('hides CI status when null', () => {
    renderCard({ ci_status: null });
    expect(screen.queryByTitle(/^CI:/)).not.toBeInTheDocument();
  });

  it('hides enrichment fields when toggled off via fields prop', () => {
    renderCard(
      { open_prs: 5, ci_status: 'SUCCESS', latest_release: { tag: 'v1.0', published_at: '2024-01-01' } },
      { open_prs: false, ci_status: false, latest_release: false }
    );
    expect(screen.queryByTitle(/open PRs/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/^CI:/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Latest release/)).not.toBeInTheDocument();
  });
});
