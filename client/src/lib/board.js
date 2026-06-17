export const defaultFilters = { showOwn: true, showForks: true, showArchived: true };

// Substring match across name, description, and language. Empty query matches all.
// Shared by the global toolbar filter and the per-column filter.
export function repoMatchesQuery(repo, query) {
    const term = (query || '').trim().toLowerCase();
    if (!term) return true;
    const haystack = `${repo.name} ${repo.description || ''} ${repo.language || ''}`.toLowerCase();
    return haystack.includes(term);
}

// Tag-filter predicate. `selected` empty = passes. mode 'all' = repo must carry
// every selected tag; 'any' = at least one.
export function matchesTagFilter(repo, selected, mode = 'any') {
    if (!selected || selected.length === 0) return true;
    const tags = repo.tags || [];
    return mode === 'all'
        ? selected.every((t) => tags.includes(t))
        : selected.some((t) => tags.includes(t));
}

// Priority-filter predicate. `selected` is a list of levels (1|2|3, or 0 for
// "no priority"). Empty = passes. An independent axis from the inclusive
// own/forks/archived filters and the tag filter.
export function matchesPriorityFilter(repo, selected) {
    if (!selected || selected.length === 0) return true;
    return selected.includes(repo.priority ?? 0);
}

// Distinct tags across repos with usage counts, sorted by count desc then name.
export function collectTags(repos) {
    const counts = new Map();
    for (const repo of repos) {
        for (const tag of repo.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// `showIgnored` is an independent axis from the inclusive own/forks/archived
// filters: ignored repos are dropped first, regardless of the other toggles,
// unless the global "show ignored" switch is on. `tagFilter` ({ tags, mode })
// further narrows to repos matching the selected tags; `priorityFilter` (a list
// of levels) narrows by triage priority, independent of every other axis.
export function filterRepos(repos, query, filters, showIgnored = false, tagFilter = null, priorityFilter = null) {
    return repos.filter((repo) => {
        if (repo.ignored && !showIgnored) return false;
        if (tagFilter && !matchesTagFilter(repo, tagFilter.tags, tagFilter.mode)) return false;
        if (!matchesPriorityFilter(repo, priorityFilter)) return false;

        const isOwn = !repo.fork && !repo.archived;
        const visible =
            (filters.showOwn && isOwn) ||
            (filters.showForks && repo.fork) ||
            (filters.showArchived && repo.archived);
        if (!visible) return false;

        return repoMatchesQuery(repo, query);
    });
}

// Column comparators for the list/table view. Each is an ascending comparator;
// `sortReposForList` flips the sign for descending and falls back to repo name
// so the order is stable.
const listPushedMs = (r) => (r.pushed_at ? Date.parse(r.pushed_at) : 0);
export const LIST_COLUMNS = ['repo', 'owner', 'priority', 'language', 'pushed', 'stars', 'issues', 'forks', 'due', 'checked'];
const LIST_SORTERS = {
    repo: (a, b) => (a.name || '').localeCompare(b.name || ''),
    owner: (a, b) => (a.owner || '').localeCompare(b.owner || ''),
    priority: (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
    language: (a, b) => (a.language || '').localeCompare(b.language || ''),
    pushed: (a, b) => listPushedMs(a) - listPushedMs(b),
    stars: (a, b) => (a.stargazers_count || 0) - (b.stargazers_count || 0),
    issues: (a, b) => (a.open_issues_count || 0) - (b.open_issues_count || 0),
    forks: (a, b) => (a.forks_count || 0) - (b.forks_count || 0),
    due: (a, b) => (a.dueInDays ?? Infinity) - (b.dueInDays ?? Infinity),
    checked: (a, b) => (a.checkedAgeDays ?? Infinity) - (b.checkedAgeDays ?? Infinity),
};

export function sortReposForList(repos, col = 'repo', dir = 'asc') {
    const cmp = LIST_SORTERS[col] || LIST_SORTERS.repo;
    const sign = dir === 'desc' ? -1 : 1;
    return [...repos].sort((a, b) => cmp(a, b) * sign || (a.name || '').localeCompare(b.name || ''));
}

// Sort a flat list of notices by date or repo name, ascending or descending.
// Used by the notices dialog for both single-repo and all-repo views.
export function sortNotices(notices, sort = 'date', dir = 'desc') {
    const mul = dir === 'asc' ? 1 : -1;
    return [...notices].sort((a, b) => {
        if (sort === 'repo') {
            const byName = (a.full_name || '').localeCompare(b.full_name || '');
            if (byName) return byName * mul;
        }
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * mul;
    });
}

export function buildDayColumns(defaultInactivityDays, calendarLabelFn) {
    const defaultDays = Math.max(0, Number(defaultInactivityDays) || 0);
    const totalColumns = Math.max(1, defaultDays);

    return Array.from({ length: totalColumns }, (_, offset) => {
        const { title, subtitle } = calendarLabelFn(offset);
        return {
            key: `day-${offset}`,
            title,
            subtitle,
            daysAgoTarget: Math.max(0, defaultDays - offset),
            accent: offset === 0 ? 'rose' : offset < 3 ? 'amber' : 'sky',
        };
    });
}

// Within-column ordering. `manual` is the drag order (saved positions); the
// rest are read-only derived orders. Every sorter falls back to name so the
// order is stable. `pushed`/`stars` are descending (most recent / most starred
// first); `due` is ascending (soonest first).
const pushedMs = (r) => (r.pushed_at ? Date.parse(r.pushed_at) : 0);
export const SORT_KEYS = ['manual', 'name', 'pushed', 'stars', 'due'];
const SORTERS = {
    manual: (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    pushed: (a, b) => pushedMs(b) - pushedMs(a) || a.name.localeCompare(b.name),
    stars: (a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0) || a.name.localeCompare(b.name),
    due: (a, b) => (a.dueInDays ?? Infinity) - (b.dueInDays ?? Infinity) || a.name.localeCompare(b.name),
};

// Alternative groupings to the day schedule. `day` keeps the schedule board;
// the rest re-column the board by a repo attribute (read-only — no scheduling).
export const GROUP_BY_KEYS = ['day', 'owner', 'tag', 'language'];

// Build generic columns for a non-day grouping. Returns an ordered list of
// { key, title, subtitle, accent, repos, schedulable:false }. Tags fan out (a
// repo appears under each of its tags) plus an "untagged" bucket; owner and
// language use one bucket each with a "none" fallback. Columns are ordered by
// repo count (desc) then title, with the "none" bucket pinned last; within a
// column the chosen sort applies.
export function groupReposBy(repos, field, sortKey = 'manual') {
    const NONE = '__none__';
    const buckets = new Map();
    const add = (key, title, repo) => {
        if (!buckets.has(key)) buckets.set(key, { key, title, repos: [] });
        buckets.get(key).repos.push(repo);
    };

    for (const r of repos) {
        if (field === 'tag') {
            const tags = r.tags || [];
            if (tags.length === 0) add(NONE, 'untagged', r);
            else for (const t of tags) add(`tag:${t}`, `#${t}`, r);
        } else {
            const v = (field === 'owner' ? r.owner : r.language) || null;
            if (v) add(`${field}:${v}`, v, r);
            else add(NONE, field === 'owner' ? 'no owner' : 'no language', r);
        }
    }

    const cmp = SORTERS[sortKey] || SORTERS.manual;
    const cols = [...buckets.values()];
    for (const c of cols) {
        c.repos.sort(cmp);
        c.subtitle = `${c.repos.length} ${c.repos.length === 1 ? 'repo' : 'repos'}`;
        c.accent = 'neutral';
        c.schedulable = false;
    }
    cols.sort((a, b) => {
        const an = a.key === NONE;
        const bn = b.key === NONE;
        if (an !== bn) return an ? 1 : -1;
        return b.repos.length - a.repos.length || a.title.localeCompare(b.title);
    });
    return cols;
}

// Per-column, on-demand ordering chosen from a column's own sort dropdown. This
// overrides the board-wide within-column sort for that single column only. Keys
// map to ascending comparators; `dir` flips the sign. An unknown/empty key
// returns the repos untouched (i.e. keep the incoming board order).
export const COLUMN_SORT_KEYS = ['name', 'stars', 'owner'];
const COLUMN_SORTERS = {
    name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    stars: (a, b) => (a.stargazers_count || 0) - (b.stargazers_count || 0),
    owner: (a, b) => (a.owner || '').localeCompare(b.owner || ''),
};
export function sortColumnRepos(repos, key, dir = 'asc') {
    const cmp = COLUMN_SORTERS[key];
    if (!cmp) return repos;
    const sign = dir === 'desc' ? -1 : 1;
    return [...repos].sort((a, b) => cmp(a, b) * sign || (a.name || '').localeCompare(b.name || ''));
}

export function groupRepos(repos, dayColumns, sortKey = 'manual') {
    const groups = Object.fromEntries(dayColumns.map((col) => [col.key, []]));

    for (const repo of repos) {
        if (repo.column === 'unchecked') continue;
        const key = groups[repo.column] ? repo.column : 'day-0';
        groups[key].push(repo);
    }

    const cmp = SORTERS[sortKey] || SORTERS.manual;
    for (const key of Object.keys(groups)) {
        groups[key].sort(cmp);
    }

    return groups;
}
