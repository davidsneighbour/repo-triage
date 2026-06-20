import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cx, ACCENT, ICON } from '../lib/constants.js';
import { repoMatchesQuery, sortColumnRepos } from '../lib/board.js';
import { RepoCard } from './RepoCard.jsx';

// Per-column sort options surfaced in the column's own dropdown. The blank value
// keeps the board-wide order; each axis offers ascending and descending.
const COLUMN_SORT_OPTIONS = [
  { value: '', label: 'default order' },
  { value: 'name:asc', label: 'name ↑' },
  { value: 'name:desc', label: 'name ↓' },
  { value: 'stars:asc', label: 'stars ↑' },
  { value: 'stars:desc', label: 'stars ↓' },
  { value: 'owner:asc', label: 'owner ↑' },
  { value: 'owner:desc', label: 'owner ↓' },
];

export function Column({ col, repos, onDropColumn, schedulable = true, mobile = false, ...cardProps }) {
  const acc = ACCENT[col.accent];
  const ColSearchIcon = ICON.search;
  const SortIcon = ICON.sort;
  // Destructure before useState so colFilterCache is in scope for the lazy init.
  const { selectedIds, onSelectMany, onToggleSelect, onAnnounceMove, colFilterCache, ...cardRest } = cardProps;
  const [over, setOver] = useState(false);
  const [cq, setCq] = useState(() => colFilterCache?.current?.[col.key] ?? '');
  const [sort, setSort] = useState('');
  const [sortKey, sortDir] = sort ? sort.split(':') : [null, 'asc'];
  const ordered = useMemo(() => sortColumnRepos(repos, sortKey, sortDir), [repos, sortKey, sortDir]);
  const visible = useMemo(() => ordered.filter((r) => repoMatchesQuery(r, cq)), [ordered, cq]);
  const filtering = cq.trim() !== '';

  // Select-all reflects (and toggles) only the currently visible cards so a
  // column filter scopes the bulk selection too.
  const canSelect = Boolean(onToggleSelect && onSelectMany);
  const visibleIds = useMemo(() => visible.map((r) => r.id), [visible]);
  const selectedCount = canSelect ? visibleIds.filter((id) => selectedIds?.has(id)).length : 0;
  const allSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div role="group" aria-label={`${col.title} column, ${repos.length} repositories`} className={cx('flex h-full flex-col', mobile ? 'w-full' : 'w-72 shrink-0')}>
      <div className={cx('mb-2 flex items-center justify-between rounded-lg border bg-neutral-900/40 px-3 py-2', acc.edge)}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx('h-2 w-2 shrink-0 rounded-full', acc.dot)} />
          <span className={cx('truncate text-sm font-semibold', acc.head)}>{col.title}</span>
          <span className="truncate text-[11px] text-neutral-600">{col.subtitle}</span>
        </div>
        <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] tabular-nums text-neutral-300">
          {filtering ? `${visible.length}/${repos.length}` : repos.length}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-1">
        {canSelect && (
          <label className="flex shrink-0 items-center" title={`Select all in ${col.title}`}>
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              disabled={visibleIds.length === 0}
              onChange={(e) => onSelectMany(visibleIds, e.target.checked)}
              aria-label={`Select all in ${col.title}`}
              className="accent-neutral-400 disabled:opacity-40"
            />
          </label>
        )}
        <label className="relative block flex-1">
          <ColSearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-600" aria-hidden="true" />
          <input
            value={cq}
            onChange={(e) => { setCq(e.target.value); if (colFilterCache) colFilterCache.current[col.key] = e.target.value; }}
            placeholder="filter column..."
            aria-label={`Filter ${col.title} column`}
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 pl-7 pr-7 py-1 text-[11px] text-neutral-100 outline-hidden focus:border-neutral-600"
          />
          {cq && (
            <button
              type="button"
              onClick={() => { setCq(''); if (colFilterCache) colFilterCache.current[col.key] = ''; }}
              aria-label={`Clear ${col.title} filter`}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-neutral-600 hover:text-neutral-200"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </label>
        <label className="flex shrink-0 items-center" title={`Sort ${col.title}`}>
          <span className="sr-only">{`Sort ${col.title} column`}</span>
          <SortIcon className="mr-0.5 h-3 w-3 text-neutral-600" aria-hidden="true" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label={`Sort ${col.title} column`}
            className={cx(
              'rounded-md border px-1 py-1 text-[10px] outline-hidden transition-colors focus:border-neutral-500',
              sort ? 'border-neutral-600 bg-neutral-800 text-neutral-200' : 'border-neutral-800 bg-transparent text-neutral-500'
            )}
          >
            {COLUMN_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div
        onDragOver={(e) => {
          if (!schedulable) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!schedulable) return;
          e.preventDefault();
          setOver(false);
          const id = Number(e.dataTransfer.getData('text/plain'));
          if (id) {
            onDropColumn(id, col.daysAgoTarget);
            onAnnounceMove?.(id, col.daysAgoTarget);
          }
        }}
        aria-dropeffect={schedulable ? 'move' : undefined}
        className={cx(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-dashed p-2 transition-colors',
          over ? 'border-neutral-500 bg-neutral-900/60' : 'border-neutral-800/60'
        )}
      >
        {visible.map((r) => (
          <RepoCard
            key={r.id}
            repo={r}
            column={col}
            schedulable={schedulable}
            mobile={mobile}
            selected={selectedIds ? selectedIds.has(r.id) : false}
            onToggleSelect={onToggleSelect}
            onAnnounceMove={onAnnounceMove}
            {...cardRest}
          />
        ))}
        {repos.length === 0 && (
          <div className="grid flex-1 place-items-center text-center text-xs text-neutral-700">{schedulable ? 'drag here' : 'empty'}</div>
        )}
        {repos.length > 0 && visible.length === 0 && (
          <div className="grid flex-1 place-items-center text-center text-xs text-neutral-700">no matches</div>
        )}
      </div>
    </div>
  );
}
