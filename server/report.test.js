import { describe, expect, it } from 'vitest';
import { buildReport, toCsv, toMarkdown, REPORT_KINDS } from './report.js';

const NOW = '2026-06-03T00:00:00.000Z';
const REPOS = [
  { id: 1, full_name: 'me/alpha', owner: 'me', needsCheckToday: true, checkedAgeDays: null, ignored: false, archived: false, fork: false, language: 'JavaScript', pushed_at: '2026-06-01T00:00:00.000Z', tags: ['infra'], open_issues_count: 4, stargazers_count: 9 },
  { id: 2, full_name: 'dnbhq/beta', owner: 'dnbhq', needsCheckToday: false, checkedAgeDays: 2, ignored: false, archived: true, fork: false, language: 'Go', pushed_at: '2024-01-01T00:00:00.000Z', tags: [], open_issues_count: 0, stargazers_count: 0 },
  { id: 3, full_name: 'me/hidden', owner: 'me', needsCheckToday: true, checkedAgeDays: null, ignored: true, archived: false, fork: true, language: 'Go', pushed_at: '2026-05-01T00:00:00.000Z', tags: [], open_issues_count: 1, stargazers_count: 0 },
];

describe('buildReport', () => {
  it('summary counts respect ignored repos', () => {
    const r = buildReport('summary', REPOS, { now: NOW });
    const map = Object.fromEntries(r.rows);
    expect(map['total repos']).toBe(3);
    expect(map['due today']).toBe(1); // ignored me/hidden excluded
    expect(map['never reviewed']).toBe(1);
    expect(map.ignored).toBe(1);
    expect(map.archived).toBe(1);
    expect(map.owners).toBe(2);
    expect(map.tags).toBe(1);
  });

  it('due lists only non-ignored repos needing review', () => {
    const r = buildReport('due', REPOS, { now: NOW });
    expect(r.rows.map((row) => row[0])).toEqual(['me/alpha']);
  });

  it('stale uses the days window and sorts oldest first', () => {
    const r = buildReport('stale', REPOS, { now: NOW, days: 180 });
    expect(r.title).toMatch(/180d/);
    expect(r.rows.map((row) => row[0])).toEqual(['dnbhq/beta']);
  });

  it('owners aggregates per owner', () => {
    const r = buildReport('owners', REPOS, { now: NOW });
    const me = r.rows.find((row) => row[0] === 'me');
    expect(me).toEqual(['me', 2, 2, 0]);
  });

  it('active lists repos with open issues, sorted desc', () => {
    const r = buildReport('active', REPOS, { now: NOW });
    expect(r.rows.map((row) => row[0])).toEqual(['me/alpha', 'me/hidden']);
  });

  it('never-reviewed lists non-ignored repos without a check date', () => {
    const r = buildReport('never-reviewed', REPOS, { now: NOW });
    // me/alpha has checkedAgeDays null and is not ignored; me/hidden is ignored.
    expect(r.rows.map((row) => row[0])).toEqual(['me/alpha']);
    expect(r.columns).toContain('pushed');
  });

  it('languages tallies per language, sorted by count desc', () => {
    const r = buildReport('languages', REPOS, { now: NOW });
    // Two Go repos, one JavaScript.
    expect(r.rows).toEqual([
      ['Go', 2],
      ['JavaScript', 1],
    ]);
  });

  it('archived lists archived repos sorted by full name', () => {
    const r = buildReport('archived', REPOS, { now: NOW });
    expect(r.rows.map((row) => row[0])).toEqual(['dnbhq/beta']);
  });

  it('handles sparse repos (missing owner / pushed_at / tags / counts)', () => {
    const sparse = [
      { id: 9, full_name: 'x/y', needsCheckToday: true, checkedAgeDays: 0, ignored: false, archived: true, fork: false, pushed_at: null, open_issues_count: 2, stargazers_count: undefined },
    ];
    // owner/'—' fallbacks, dateOnly('') for null pushed_at, empty tag string.
    const owners = buildReport('owners', sparse, { now: NOW });
    expect(owners.rows).toEqual([['—', 1, 1, 1]]);

    const langs = buildReport('languages', sparse, { now: NOW });
    expect(langs.rows).toEqual([['—', 1]]);

    const due = buildReport('due', sparse, { now: NOW });
    expect(due.rows).toEqual([['x/y', '', 'today', '']]);

    const active = buildReport('active', sparse, { now: NOW });
    expect(active.rows).toEqual([['x/y', '', 2, 0]]);

    const archived = buildReport('archived', sparse, { now: NOW });
    expect(archived.rows).toEqual([['x/y', '', '']]);
  });

  it('defaults the stale window to 180 days when unspecified', () => {
    const r = buildReport('stale', REPOS);
    expect(r.title).toMatch(/180d/);
  });

  it('stale excludes never-pushed repos and sorts the rest oldest-first', () => {
    const repos = [
      { id: 1, full_name: 'a/never', ignored: false, pushed_at: null },
      { id: 2, full_name: 'a/older', ignored: false, pushed_at: '2023-01-01T00:00:00.000Z' },
      { id: 3, full_name: 'a/old', ignored: false, pushed_at: '2024-06-01T00:00:00.000Z' },
    ];
    const r = buildReport('stale', repos, { now: NOW, days: 30 });
    // null pushed_at dropped; remaining sorted oldest → newest.
    expect(r.rows.map((row) => row[0])).toEqual(['a/older', 'a/old']);
  });

  it('breaks owner/language ties alphabetically', () => {
    const tied = [
      { id: 1, full_name: 'zeta/a', owner: 'zeta', language: 'Rust', needsCheckToday: false, archived: false, ignored: false },
      { id: 2, full_name: 'alpha/a', owner: 'alpha', language: 'Elixir', needsCheckToday: false, archived: false, ignored: false },
    ];
    // Each owner and each language has the same count (1), so the alphabetical
    // tie-breaker decides order.
    expect(buildReport('owners', tied, { now: NOW }).rows.map((r) => r[0])).toEqual(['alpha', 'zeta']);
    expect(buildReport('languages', tied, { now: NOW }).rows.map((r) => r[0])).toEqual(['Elixir', 'Rust']);
  });

  it('weekly composes sections for due / never-reviewed / stale / owners / summary', () => {
    const r = buildReport('weekly', REPOS, { now: NOW });
    expect(r.kind).toBe('weekly');
    expect(r.title).toBe('Weekly Triage Digest');
    expect(r.generatedAt).toBe(NOW);
    expect(Array.isArray(r.sections)).toBe(true);
    const kinds = r.sections.map((s) => s.kind);
    expect(kinds).toContain('summary');
    expect(kinds).toContain('due');
    expect(kinds).toContain('never-reviewed');
    expect(kinds).toContain('stale');
    expect(kinds).toContain('owners');
  });

  it('weekly passes the days option to the stale section', () => {
    const r = buildReport('weekly', REPOS, { now: NOW, days: 30 });
    const stale = r.sections.find((s) => s.kind === 'stale');
    expect(stale.title).toMatch(/30d/);
  });

  it('weekly defaults stale window to 90 days', () => {
    const r = buildReport('weekly', REPOS, { now: NOW });
    const stale = r.sections.find((s) => s.kind === 'stale');
    expect(stale.title).toMatch(/90d/);
  });

  it('throws on an unknown kind', () => {
    expect(() => buildReport('nope', REPOS)).toThrow(/unknown report/);
  });

  it('exposes the kind list', () => {
    expect(REPORT_KINDS).toContain('summary');
    expect(REPORT_KINDS).toContain('weekly');
  });
});

describe('formatters', () => {
  const report = { kind: 'due', title: 'Due today', generatedAt: NOW, columns: ['repo', 'note'], rows: [['a/b', 'has | pipe']] };

  it('renders a markdown table and escapes pipes', () => {
    const md = toMarkdown(report);
    expect(md).toContain('| repo | note |');
    expect(md).toContain('has \\| pipe');
  });

  it('renders an empty markdown notice', () => {
    expect(toMarkdown({ ...report, rows: [] })).toMatch(/No matching repositories/);
  });

  it('renders csv with quoting for special characters', () => {
    const csv = toCsv({ ...report, rows: [['a,b', 'q"x']] });
    expect(csv).toContain('"a,b","q""x"');
  });

  it('toMarkdown renders weekly as a h1 header followed by each section', () => {
    const weekly = buildReport('weekly', REPOS, { now: NOW });
    const md = toMarkdown(weekly);
    expect(md).toMatch(/^# Weekly Triage Digest/);
    expect(md).toContain('## Summary');
    expect(md).toContain('## Due today');
    expect(md).toContain('## Never reviewed');
    expect(md).toContain('## Per owner');
  });

  it('toCsv renders weekly by concatenating sections with headings', () => {
    const weekly = buildReport('weekly', REPOS, { now: NOW });
    const csv = toCsv(weekly);
    expect(csv).toContain('# Summary');
    expect(csv).toContain('# Due today');
    expect(csv).toContain('metric,value');
  });

  it('toMarkdown treats null/undefined row values as empty strings', () => {
    const md = toMarkdown({ ...report, rows: [[null, undefined]] });
    expect(md).toContain('|  |  |');
  });

  it('toCsv treats null/undefined row values as empty strings', () => {
    const csv = toCsv({ ...report, rows: [[null, undefined]] });
    expect(csv).toContain(',\n');
  });
});

describe('buildReport weekly staleDays fallback', () => {
  it('defaults staleDays to 0 when days is a non-numeric string', () => {
    const r = buildReport('weekly', REPOS, { now: NOW, days: 'bad' });
    const stale = r.sections.find((s) => s.kind === 'stale');
    expect(stale.title).toMatch(/0d/);
  });
});
