// Pure filter/sort helpers for the per-repo Issues dialog. Kept separate from
// the component so they're trivially unit-testable (see board.js/date.js for
// the same pattern used by the rest of the board).

export function filterIssues(issues, { search = '', tags = [], state = 'all', flaggedOnly = false } = {}) {
  const q = search.trim().toLowerCase();
  return issues.filter((issue) => {
    if (state !== 'all' && issue.state !== state) return false;
    if (flaggedOnly && !issue.flagged) return false;
    if (tags.length > 0 && !tags.some((t) => issue.labels.includes(t))) return false;
    if (q) {
      const haystack = `${issue.title} ${issue.body || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function sortIssues(issues, sort = 'number', dir = 'desc') {
  const mul = dir === 'asc' ? 1 : -1;
  return [...issues].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title) * mul;
    if (sort === 'repo') return (a.repo_full_name || '').localeCompare(b.repo_full_name || '') * mul;
    if (sort === 'updated') {
      const at = a.github_updated_at ? new Date(a.github_updated_at).getTime() : 0;
      const bt = b.github_updated_at ? new Date(b.github_updated_at).getTime() : 0;
      return (at - bt) * mul;
    }
    return (a.number - b.number) * mul;
  });
}
