import { describe, expect, it } from 'vitest';
import { buildDayColumns, collectTags, defaultFilters, filterRepos, groupRepos, matchesTagFilter, repoMatchesQuery, sortNotices } from './board.js';

const repos = [
    { id: 1, name: 'own-live', description: 'alpha', language: 'JS', fork: false, archived: false, column: 'day-0', position: 2 },
    { id: 2, name: 'fork-live', description: 'beta', language: 'TS', fork: true, archived: false, column: 'day-1', position: 1 },
    { id: 3, name: 'own-archived', description: 'gamma', language: 'Go', fork: false, archived: true, column: 'day-2', position: 0 },
];

describe('filterRepos', () => {
    it('includes all repos with default filters', () => {
        expect(filterRepos(repos, '', defaultFilters)).toHaveLength(3);
    });

    it('applies inclusive union visibility filters', () => {
        const filtered = filterRepos(repos, '', { showOwn: true, showForks: false, showArchived: false });
        expect(filtered.map((repo) => repo.id)).toEqual([1]);
    });

    it('matches search term against name/description/language', () => {
        expect(filterRepos(repos, 'go', defaultFilters).map((repo) => repo.id)).toEqual([3]);
    });

    it('hides ignored repos by default and shows them when showIgnored is on', () => {
        const withIgnored = [...repos, { id: 9, name: 'hidden', fork: false, archived: false, ignored: true }];
        expect(filterRepos(withIgnored, '', defaultFilters).map((r) => r.id)).not.toContain(9);
        expect(filterRepos(withIgnored, '', defaultFilters, true).map((r) => r.id)).toContain(9);
    });

    it('narrows by the tag filter (any / all)', () => {
        const tagged = [
            { id: 10, name: 't1', fork: false, archived: false, tags: ['infra'] },
            { id: 11, name: 't2', fork: false, archived: false, tags: ['oss', 'infra'] },
        ];
        expect(filterRepos(tagged, '', defaultFilters, false, { tags: ['oss'], mode: 'any' }).map((r) => r.id)).toEqual([11]);
        expect(filterRepos(tagged, '', defaultFilters, false, { tags: ['oss', 'infra'], mode: 'all' }).map((r) => r.id)).toEqual([11]);
        expect(filterRepos(tagged, '', defaultFilters, false, { tags: ['oss', 'infra'], mode: 'any' }).map((r) => r.id)).toEqual([10, 11]);
    });
});

describe('matchesTagFilter', () => {
    const repo = { tags: ['infra', 'oss'] };

    it('passes when no tags are selected', () => {
        expect(matchesTagFilter(repo, [])).toBe(true);
        expect(matchesTagFilter(repo, undefined)).toBe(true);
    });

    it('any mode matches when at least one selected tag is present', () => {
        expect(matchesTagFilter(repo, ['oss', 'x'], 'any')).toBe(true);
        expect(matchesTagFilter(repo, ['x'], 'any')).toBe(false);
    });

    it('all mode matches only when every selected tag is present', () => {
        expect(matchesTagFilter(repo, ['infra', 'oss'], 'all')).toBe(true);
        expect(matchesTagFilter(repo, ['infra', 'x'], 'all')).toBe(false);
    });

    it('tolerates repos with no tags', () => {
        expect(matchesTagFilter({}, ['x'], 'any')).toBe(false);
    });
});

describe('collectTags', () => {
    it('counts distinct tags, sorted by count then name', () => {
        const repos2 = [{ tags: ['a', 'b'] }, { tags: ['a'] }, { tags: [] }, {}];
        expect(collectTags(repos2)).toEqual([
            { tag: 'a', count: 2 },
            { tag: 'b', count: 1 },
        ]);
    });
});

describe('sortNotices', () => {
    const notices = [
        { id: 1, full_name: 'b/repo', created_at: '2026-06-01T00:00:00.000Z' },
        { id: 2, full_name: 'a/repo', created_at: '2026-06-03T00:00:00.000Z' },
        { id: 3, full_name: 'c/repo', created_at: '2026-06-02T00:00:00.000Z' },
    ];

    it('sorts by date descending by default', () => {
        expect(sortNotices(notices).map((n) => n.id)).toEqual([2, 3, 1]);
    });

    it('sorts by date ascending', () => {
        expect(sortNotices(notices, 'date', 'asc').map((n) => n.id)).toEqual([1, 3, 2]);
    });

    it('sorts by repo name', () => {
        expect(sortNotices(notices, 'repo', 'asc').map((n) => n.full_name)).toEqual(['a/repo', 'b/repo', 'c/repo']);
    });

    it('does not mutate the input array', () => {
        const input = [...notices];
        sortNotices(input, 'repo', 'desc');
        expect(input.map((n) => n.id)).toEqual([1, 2, 3]);
    });
});

describe('repoMatchesQuery', () => {
    const repo = repos[2]; // own-archived / gamma / Go

    it('matches everything for an empty or whitespace query', () => {
        expect(repoMatchesQuery(repo, '')).toBe(true);
        expect(repoMatchesQuery(repo, '   ')).toBe(true);
        expect(repoMatchesQuery(repo, undefined)).toBe(true);
    });

    it('matches name, description, and language case-insensitively', () => {
        expect(repoMatchesQuery(repo, 'OWN')).toBe(true);
        expect(repoMatchesQuery(repo, 'gamma')).toBe(true);
        expect(repoMatchesQuery(repo, 'go')).toBe(true);
    });

    it('returns false when nothing matches', () => {
        expect(repoMatchesQuery(repo, 'zzz')).toBe(false);
    });

    it('tolerates a missing description or language', () => {
        expect(repoMatchesQuery({ name: 'solo' }, 'solo')).toBe(true);
        expect(repoMatchesQuery({ name: 'solo' }, 'js')).toBe(false);
    });
});

describe('buildDayColumns', () => {
    it('builds expected day columns from inactivity days', () => {
        const columns = buildDayColumns(4, (offset) => ({ title: `d${offset}`, subtitle: `s${offset}` }));
        expect(columns.map((column) => column.key)).toEqual(['day-0', 'day-1', 'day-2', 'day-3']);
        expect(columns[0].accent).toBe('rose');
        expect(columns[1].accent).toBe('amber');
        expect(columns[3].accent).toBe('sky');
        expect(columns[0].daysAgoTarget).toBe(4);
        expect(columns[3].daysAgoTarget).toBe(1);
    });
});

describe('groupRepos', () => {
    it('groups by column and sorts by position then name', () => {
        const columns = [
            { key: 'day-0' },
            { key: 'day-1' },
            { key: 'day-2' },
        ];
        const grouped = groupRepos(
            [
                repos[0],
                { ...repos[0], id: 4, name: 'aaa', column: 'day-0', position: 2 },
                repos[1],
                repos[2],
            ],
            columns
        );

        expect(grouped['day-0'].map((repo) => repo.id)).toEqual([4, 1]);
        expect(grouped['day-1'].map((repo) => repo.id)).toEqual([2]);
        expect(grouped['day-2'].map((repo) => repo.id)).toEqual([3]);
    });
});
