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
// further narrows to repos matching the selected tags.
export function filterRepos(repos, query, filters, showIgnored = false, tagFilter = null) {
    return repos.filter((repo) => {
        if (repo.ignored && !showIgnored) return false;
        if (tagFilter && !matchesTagFilter(repo, tagFilter.tags, tagFilter.mode)) return false;

        const isOwn = !repo.fork && !repo.archived;
        const visible =
            (filters.showOwn && isOwn) ||
            (filters.showForks && repo.fork) ||
            (filters.showArchived && repo.archived);
        if (!visible) return false;

        return repoMatchesQuery(repo, query);
    });
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

export function groupRepos(repos, dayColumns) {
    const groups = Object.fromEntries(dayColumns.map((col) => [col.key, []]));

    for (const repo of repos) {
        const key = groups[repo.column] ? repo.column : 'day-0';
        groups[key].push(repo);
    }

    for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    }

    return groups;
}
