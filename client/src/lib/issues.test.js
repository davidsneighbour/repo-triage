import { describe, expect, it } from 'vitest';
import { filterIssues, sortIssues } from './issues.js';

const issue = (over = {}) => ({
  number: 1, title: 'a bug', state: 'open', labels: [], body: 'details',
  html_url: 'https://x/1', github_updated_at: '2026-07-01T00:00:00Z',
  ...over,
});

describe('filterIssues', () => {
  it('returns all issues when no filters are applied', () => {
    const issues = [issue({ number: 1 }), issue({ number: 2 })];
    expect(filterIssues(issues)).toHaveLength(2);
  });

  it('filters by state', () => {
    const issues = [issue({ number: 1, state: 'open' }), issue({ number: 2, state: 'closed' })];
    expect(filterIssues(issues, { state: 'closed' })).toEqual([issue({ number: 2, state: 'closed' })]);
  });

  it('filters by search across title and body', () => {
    const issues = [
      issue({ number: 1, title: 'fix the crash', body: 'x' }),
      issue({ number: 2, title: 'unrelated', body: 'mentions crash here' }),
      issue({ number: 3, title: 'nothing', body: 'nothing' }),
    ];
    const result = filterIssues(issues, { search: 'crash' });
    expect(result.map((i) => i.number)).toEqual([1, 2]);
  });

  it('search is case-insensitive', () => {
    const issues = [issue({ number: 1, title: 'CRASH' })];
    expect(filterIssues(issues, { search: 'crash' })).toHaveLength(1);
  });

  it('filters by tag with any-match semantics', () => {
    const issues = [
      issue({ number: 1, labels: ['bug'] }),
      issue({ number: 2, labels: ['docs'] }),
      issue({ number: 3, labels: ['bug', 'docs'] }),
    ];
    const result = filterIssues(issues, { tags: ['bug'] });
    expect(result.map((i) => i.number)).toEqual([1, 3]);
  });

  it('matches when any of multiple selected tags is present', () => {
    const issues = [
      issue({ number: 1, labels: ['bug'] }),
      issue({ number: 2, labels: ['docs'] }),
      issue({ number: 3, labels: ['chore'] }),
    ];
    const result = filterIssues(issues, { tags: ['bug', 'docs'] });
    expect(result.map((i) => i.number)).toEqual([1, 2]);
  });

  it('filters to flagged issues only when flaggedOnly is set', () => {
    const issues = [
      issue({ number: 1, flagged: true }),
      issue({ number: 2, flagged: false }),
      issue({ number: 3 }), // flagged undefined — treated as falsy
    ];
    const result = filterIssues(issues, { flaggedOnly: true });
    expect(result.map((i) => i.number)).toEqual([1]);
  });

  it('composes state, tag, and search filters', () => {
    const issues = [
      issue({ number: 1, state: 'open', labels: ['bug'], title: 'crash on load' }),
      issue({ number: 2, state: 'closed', labels: ['bug'], title: 'crash on load' }),
      issue({ number: 3, state: 'open', labels: ['docs'], title: 'crash on load' }),
    ];
    const result = filterIssues(issues, { state: 'open', tags: ['bug'], search: 'crash' });
    expect(result.map((i) => i.number)).toEqual([1]);
  });
});

describe('sortIssues', () => {
  it('sorts by number descending by default', () => {
    const issues = [issue({ number: 1 }), issue({ number: 3 }), issue({ number: 2 })];
    expect(sortIssues(issues).map((i) => i.number)).toEqual([3, 2, 1]);
  });

  it('sorts by number ascending', () => {
    const issues = [issue({ number: 3 }), issue({ number: 1 }), issue({ number: 2 })];
    expect(sortIssues(issues, 'number', 'asc').map((i) => i.number)).toEqual([1, 2, 3]);
  });

  it('sorts by title', () => {
    const issues = [issue({ number: 1, title: 'zebra' }), issue({ number: 2, title: 'apple' })];
    expect(sortIssues(issues, 'title', 'asc').map((i) => i.title)).toEqual(['apple', 'zebra']);
  });

  it('sorts by updated timestamp', () => {
    const issues = [
      issue({ number: 1, github_updated_at: '2026-01-01T00:00:00Z' }),
      issue({ number: 2, github_updated_at: '2026-06-01T00:00:00Z' }),
    ];
    expect(sortIssues(issues, 'updated', 'desc').map((i) => i.number)).toEqual([2, 1]);
  });

  it('treats a missing updated timestamp as oldest', () => {
    const issues = [
      issue({ number: 1, github_updated_at: null }),
      issue({ number: 2, github_updated_at: '2026-06-01T00:00:00Z' }),
    ];
    expect(sortIssues(issues, 'updated', 'asc').map((i) => i.number)).toEqual([1, 2]);
  });

  it('does not mutate the input array', () => {
    const issues = [issue({ number: 1 }), issue({ number: 2 })];
    const copy = [...issues];
    sortIssues(issues, 'number', 'asc');
    expect(issues).toEqual(copy);
  });
});
