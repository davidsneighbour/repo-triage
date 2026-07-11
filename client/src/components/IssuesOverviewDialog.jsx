import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, Star, X } from 'lucide-react';
import { api } from '../api.js';
import { useDialog } from '../lib/useDialog.js';
import { devId } from '../lib/devIdOverlay.js';
import { cx, tagColor } from '../lib/constants.js';
import { timeAgo } from '../lib/date.js';
import { filterIssues, sortIssues } from '../lib/issues.js';

const STATE_FILTERS = ['open', 'closed', 'all'];
const SORT_FIELDS = ['repo', 'number', 'title', 'updated'];
const OPTIONAL_COLUMNS = [
  { key: 'status', label: 'status' },
  { key: 'activity', label: 'activity' },
  { key: 'labels', label: 'labels' },
];

// All-repos issue dashboard: read-only over locally synced `repo_issue` rows
// (`GET /api/issues`). Never triggers a GitHub sync — see per-repo
// `IssuesDialog` for the sync-on-open / manual-sync surface.
export function IssuesOverviewDialog({ onClose }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('open');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sort, setSort] = useState('updated');
  const [dir, setDir] = useState('desc');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState(() => new Set(OPTIONAL_COLUMNS.map((c) => c.key)));
  const dialogRef = useDialog(onClose);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.allIssues();
      setIssues(res.issues || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleFlag = async (issue) => {
    const next = !issue.flagged;
    setIssues((prev) =>
      prev.map((i) => (i.repo_id === issue.repo_id && i.number === issue.number ? { ...i, flagged: next } : i))
    );
    try {
      await api.setIssueFlagged(issue.repo_id, issue.number, next);
    } catch {
      setIssues((prev) =>
        prev.map((i) => (i.repo_id === issue.repo_id && i.number === issue.number ? { ...i, flagged: !next } : i))
      );
    }
  };

  const toggleColumn = (key) =>
    setColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const visible = useMemo(
    () => sortIssues(filterIssues(issues, { search, state: stateFilter, flaggedOnly }), sort, dir),
    [issues, search, stateFilter, flaggedOnly, sort, dir]
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section
        {...devId('IssuesOverviewDialog')}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="issues-overview-title"
        tabIndex={-1}
        className="fixed inset-x-4 top-6 z-40 mx-auto flex max-h-[88vh] max-w-4xl flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 id="issues-overview-title" className="text-sm font-semibold text-neutral-100">Issues</h2>
            <p className="truncate text-[11px] text-neutral-500">
              {issues.length} synced issue{issues.length === 1 ? '' : 's'} across all repos
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close issues overview"
            className="shrink-0 rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search issues..."
            aria-label="Search issues"
            className="min-w-[160px] flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-100 outline-hidden focus:border-neutral-500"
          />
          <div className="flex overflow-hidden rounded-md border border-neutral-700 text-[11px]">
            {STATE_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStateFilter(s)}
                className={cx('px-2 py-1', stateFilter === s ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-md border border-neutral-700 text-[11px]">
            {SORT_FIELDS.map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cx('px-2 py-1', sort === s ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            aria-label="Toggle sort direction"
            className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] tabular-nums text-neutral-300 hover:bg-neutral-800"
          >
            {dir === 'asc' ? '↑ asc' : '↓ desc'}
          </button>
          <button
            onClick={() => setFlaggedOnly((v) => !v)}
            aria-pressed={flaggedOnly}
            className={cx(
              'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]',
              flaggedOnly ? 'border-neutral-600 bg-neutral-800 text-neutral-100' : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
            )}
          >
            <Star className={cx('h-3 w-3', flaggedOnly && 'fill-current')} aria-hidden="true" />
            flagged
          </button>
          <div className="relative">
            <button
              onClick={() => setColumnsOpen((o) => !o)}
              aria-expanded={columnsOpen}
              aria-label="Toggle columns"
              className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
            >
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              columns
            </button>
            {columnsOpen && (
              <div
                role="menu"
                aria-label="Toggle columns"
                className="absolute right-0 top-full z-10 mt-1 w-32 rounded-md border border-neutral-700 bg-neutral-900 p-1 shadow-2xl"
              >
                {OPTIONAL_COLUMNS.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800">
                    <input type="checkbox" checked={columns.has(key)} onChange={() => toggleColumn(key)} className="accent-neutral-500" />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-auto px-4 py-3">
          {loading ? (
            <p className="py-6 text-center text-xs text-neutral-600">loading...</p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-700">no matching issues</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((issue) => (
                <li key={`${issue.repo_id}-${issue.number}`} className="flex items-start gap-2 rounded-md bg-neutral-950 px-3 py-2">
                  <button
                    onClick={() => toggleFlag(issue)}
                    aria-pressed={issue.flagged}
                    aria-label={issue.flagged ? `Unflag issue #${issue.number}` : `Flag issue #${issue.number}`}
                    className={cx('mt-0.5 shrink-0', issue.flagged ? 'text-neutral-100' : 'text-neutral-600 hover:text-neutral-300')}
                  >
                    <Star className={cx('h-3.5 w-3.5', issue.flagged && 'fill-current')} aria-hidden="true" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-neutral-200">
                      <span className="text-neutral-500">#{issue.number}</span> {issue.title}
                    </p>
                    <p className="truncate text-[10px] text-neutral-500">{issue.repo_full_name || `repo ${issue.repo_id}`}</p>
                    {columns.has('labels') && issue.labels.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {issue.labels.map((label) => (
                          <span key={label} className="flex items-center gap-1 rounded-sm bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-400">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(label) }} aria-hidden="true" />
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {columns.has('status') && <span className="text-[10px] text-neutral-500">{issue.state}</span>}
                    {columns.has('activity') && (
                      <span
                        className="text-[10px] tabular-nums text-neutral-500"
                        title={issue.github_updated_at ? new Date(issue.github_updated_at).toLocaleString() : ''}
                      >
                        {timeAgo(issue.github_updated_at)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>,
    document.body
  );
}
