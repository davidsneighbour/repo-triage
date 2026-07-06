import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Star, X } from 'lucide-react';
import { api } from '../api.js';
import { useDialog } from '../lib/useDialog.js';
import { cx, tagColor } from '../lib/constants.js';
import { timeAgo } from '../lib/date.js';
import { filterIssues, sortIssues } from '../lib/issues.js';

const STATE_FILTERS = ['open', 'closed', 'all'];
const SORT_FIELDS = ['number', 'title', 'updated'];

export function IssuesDialog({ repo, onClose }) {
  const [issues, setIssues] = useState([]);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('open');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [sort, setSort] = useState('number');
  const [dir, setDir] = useState('desc');
  const [expandedNumber, setExpandedNumber] = useState(null);
  const dialogRef = useDialog(onClose);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.repoIssues(repo.id);
      setIssues(res.issues || []);
      setSyncEnabled(res.syncEnabled !== false);
    } finally {
      setLoading(false);
    }
  }, [repo.id]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await api.syncRepoIssues(repo.id);
      if (res?.error) setError(res.error);
      else await reload();
    } catch {
      setError('sync failed — is a token configured for this owner?');
    } finally {
      setSyncing(false);
    }
  }, [repo.id, reload]);

  // Initial load, then an on-demand sync the moment this repo's issue view opens.
  useEffect(() => {
    reload().then(runSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.id]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const toggleSyncEnabled = async () => {
    const next = !syncEnabled;
    setSyncEnabled(next);
    await api.setIssueSync(repo.id, next);
  };

  // Local-only marker, independent of GitHub state — optimistic update with
  // rollback on failure so the star reflects the actual persisted value.
  const toggleFlag = async (issue) => {
    const next = !issue.flagged;
    setIssues((prev) => prev.map((i) => (i.number === issue.number ? { ...i, flagged: next } : i)));
    try {
      await api.setIssueFlagged(repo.id, issue.number, next);
    } catch {
      setIssues((prev) => prev.map((i) => (i.number === issue.number ? { ...i, flagged: !next } : i)));
    }
  };

  const allTags = useMemo(() => {
    const set = new Set();
    for (const issue of issues) for (const label of issue.labels) set.add(label);
    return [...set].sort();
  }, [issues]);

  const visible = useMemo(
    () => sortIssues(filterIssues(issues, { search, tags: selectedTags, state: stateFilter, flaggedOnly }), sort, dir),
    [issues, search, selectedTags, stateFilter, flaggedOnly, sort, dir]
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="issues-dialog-title"
        tabIndex={-1}
        className="fixed inset-x-4 top-6 z-40 mx-auto flex max-h-[88vh] max-w-3xl flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 id="issues-dialog-title" className="text-sm font-semibold text-neutral-100">Issues</h2>
            <p className="truncate text-[11px] text-neutral-500">{repo.full_name || repo.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={toggleSyncEnabled}
              aria-pressed={syncEnabled}
              className={cx(
                'rounded-md border px-2 py-1 text-[11px]',
                syncEnabled ? 'border-neutral-600 bg-neutral-800 text-neutral-300' : 'border-neutral-800 text-neutral-600'
              )}
            >
              auto-sync {syncEnabled ? 'on' : 'off'}
            </button>
            <button
              onClick={runSync}
              disabled={syncing}
              className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
            >
              <RefreshCw className={cx('h-3 w-3', syncing && 'animate-spin')} aria-hidden="true" />
              {syncing ? 'syncing…' : 'sync now'}
            </button>
            <button
              onClick={onClose}
              aria-label="Close issues"
              className="rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
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
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b border-neutral-800 px-4 py-2">
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cx(
                    'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px]',
                    active ? 'border-neutral-600 bg-neutral-800 text-neutral-200' : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(tag) }} aria-hidden="true" />
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-auto px-4 py-3">
          {error && <p role="alert" className="mb-2 text-[11px] text-rose-400">{error}</p>}
          {loading ? (
            <p className="py-6 text-center text-xs text-neutral-600">loading...</p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-700">no matching issues</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((issue) => {
                const expanded = expandedNumber === issue.number;
                return (
                  <li key={issue.number} className="rounded-md bg-neutral-950">
                    <div className="flex w-full items-start gap-2 px-3 py-2">
                      <button
                        onClick={() => toggleFlag(issue)}
                        aria-pressed={issue.flagged}
                        aria-label={issue.flagged ? `Unflag issue #${issue.number}` : `Flag issue #${issue.number}`}
                        className={cx('mt-0.5 shrink-0', issue.flagged ? 'text-neutral-100' : 'text-neutral-600 hover:text-neutral-300')}
                      >
                        <Star className={cx('h-3.5 w-3.5', issue.flagged && 'fill-current')} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => setExpandedNumber(expanded ? null : issue.number)}
                        aria-expanded={expanded}
                        className="flex flex-1 items-start justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs text-neutral-200">
                            <span className="text-neutral-500">#{issue.number}</span> {issue.title}
                          </p>
                          {issue.labels.length > 0 && (
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
                          <span className="text-[10px] text-neutral-500">{issue.state}</span>
                          <span
                            className="text-[10px] tabular-nums text-neutral-500"
                            title={issue.github_updated_at ? new Date(issue.github_updated_at).toLocaleString() : ''}
                          >
                            {timeAgo(issue.github_updated_at)}
                          </span>
                        </div>
                      </button>
                    </div>
                    {expanded && (
                      <div className="border-t border-neutral-900 px-3 py-2">
                        <p className="whitespace-pre-wrap break-words text-xs text-neutral-300">
                          {issue.body || 'no description'}
                        </p>
                        {issue.html_url && (
                          <a
                            href={issue.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-[11px] text-neutral-400 underline hover:text-neutral-200"
                          >
                            View on GitHub ↗
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>,
    document.body
  );
}
