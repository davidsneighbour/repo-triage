export const defaultFilters = { showOwn: true, showForks: true, showArchived: true };

// Substring match across name, description, and language. Empty query matches all.
// Shared by the global toolbar filter and the per-column filter.
export function repoMatchesQuery(repo, query) {
    const term = (query || '').trim().toLowerCase();
    if (!term) return true;
    const haystack = `${repo.name} ${repo.description || ''} ${repo.language || ''}`.toLowerCase();
    return haystack.includes(term);
}

export function filterRepos(repos, query, filters) {
    return repos.filter((repo) => {
        const isOwn = !repo.fork && !repo.archived;
        const visible =
            (filters.showOwn && isOwn) ||
            (filters.showForks && repo.fork) ||
            (filters.showArchived && repo.archived);
        if (!visible) return false;

        return repoMatchesQuery(repo, query);
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
