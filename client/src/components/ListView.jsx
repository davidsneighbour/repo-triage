import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { cx, ICON, ownerColor, tagColor, PRIORITY_META } from '../lib/constants.js';
import { timeAgo } from '../lib/date.js';
import { sortReposForList } from '../lib/board.js';
import { CardMenu } from './CardMenu.jsx';

const checkedLabel = (r) =>
  r.checkedAgeDays == null ? '—' : r.checkedAgeDays === 0 ? 'today' : `${r.checkedAgeDays}d`;
const dueLabel = (r) => (r.needsCheckToday ? 'today' : `${r.dueInDays}d`);

const ListRow = memo(function ListRow({ repo, showOwner, fields, selected = false, onToggleSelect, menuOpenId, menuIntent, onToggleMenu, ...handlers }) {
  const SettingsIcon = ICON.settings;
  const btnRef = useRef(null);
  const show = (k) => fields[k] !== false;
  const meta = PRIORITY_META[repo.priority];

  return (
    <tr className={cx('border-b border-neutral-800/60 hover:bg-neutral-900/50', selected && 'bg-neutral-900/70')}>
      {onToggleSelect && (
        <td className="px-2 py-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(repo.id)}
            aria-label={`Select ${repo.name}`}
            className="accent-neutral-400"
          />
        </td>
      )}
      <td className="px-2 py-1">
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-neutral-100 hover:text-white hover:underline"
        >
          {repo.name}
        </a>
        {repo.ignored && <span className="ml-1 text-[10px] text-neutral-600">(ignored)</span>}
      </td>
      {showOwner && (
        <td className="px-2 py-1 text-neutral-400">
          {repo.owner && (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ownerColor(repo.owner) }} aria-hidden="true" />
              {repo.owner}
            </span>
          )}
        </td>
      )}
      <td className="px-2 py-1">
        {meta && (
          <span className={cx('inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] font-semibold', meta.chip)} title={meta.title}>
            {meta.label}
          </span>
        )}
      </td>
      {show('language') && <td className="px-2 py-1 text-neutral-400">{repo.language || '—'}</td>}
      <td className="px-2 py-1">
        <span className="flex flex-wrap gap-1">
          {(repo.tags || []).map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-sm bg-neutral-800 px-1 py-0.5 text-[10px] text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(t) }} aria-hidden="true" />
              #{t}
            </span>
          ))}
        </span>
      </td>
      {show('pushed') && <td className="px-2 py-1 tabular-nums text-neutral-500">{timeAgo(repo.pushed_at)}</td>}
      {show('stars') && <td className="px-2 py-1 text-right tabular-nums text-neutral-500">{repo.stargazers_count || 0}</td>}
      {show('issues') && <td className="px-2 py-1 text-right tabular-nums text-neutral-500">{repo.open_issues_count || 0}</td>}
      {show('forks') && <td className="px-2 py-1 text-right tabular-nums text-neutral-500">{repo.forks_count || 0}</td>}
      <td className={cx('px-2 py-1 tabular-nums', repo.needsCheckToday ? 'text-rose-300' : 'text-neutral-500')}>{dueLabel(repo)}</td>
      <td className="px-2 py-1 tabular-nums text-neutral-500">{checkedLabel(repo)}</td>
      <td className="px-2 py-1 text-right">
        <button
          ref={btnRef}
          onClick={() => onToggleMenu(repo.id)}
          aria-label={`Settings for ${repo.name}`}
          className="rounded-md px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {menuOpenId === repo.id && (
          <CardMenu repo={repo} anchorRef={btnRef} autoFocusTag={menuIntent === 'tag'} onClose={() => onToggleMenu(repo.id)} {...handlers} />
        )}
      </td>
    </tr>
  );
});

// Read/scan-oriented table alternative to the day-schedule board. Columns are
// click-to-sort; the per-row gear opens the same CardMenu as a card.
export function ListView({ repos, showOwner, fields = {}, onToggleSelect, onSelectMany, selectedIds, ...rowProps }) {
  const [sortCol, setSortCol] = useState('repo');
  const [sortDir, setSortDir] = useState('asc');
  const show = (k) => fields[k] !== false;

  const sorted = useMemo(() => sortReposForList(repos, sortCol, sortDir), [repos, sortCol, sortDir]);

  // Header "select all" toggles every row currently in the table.
  const canSelect = Boolean(onToggleSelect && onSelectMany);
  const allIds = useMemo(() => sorted.map((r) => r.id), [sorted]);
  const selectedCount = canSelect ? allIds.filter((id) => selectedIds?.has(id)).length : 0;
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  // Descending-first for the numeric/recency columns; ascending-first otherwise.
  const onSort = (col) => {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(['pushed', 'stars', 'issues'].includes(col) ? 'desc' : 'asc');
    }
  };

  const arrow = (col) => (col === sortCol ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');
  const Th = ({ col, label, className }) => (
    <th className={cx('px-2 py-1.5 font-medium', className)}>
      <button
        onClick={() => onSort(col)}
        aria-label={`Sort by ${label}`}
        className={cx('hover:text-neutral-200', col === sortCol ? 'text-neutral-200' : 'text-neutral-500')}
      >
        {label}
        {arrow(col)}
      </button>
    </th>
  );

  if (repos.length === 0) {
    return <div className="grid flex-1 place-items-center text-center text-sm text-neutral-700">no repositories match</div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="sticky top-0 bg-neutral-950">
          <tr className="border-b border-neutral-800">
            {onToggleSelect && (
              <th className="px-2 py-1.5">
                {canSelect && (
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectMany(allIds, e.target.checked)}
                    aria-label="Select all repositories"
                    className="accent-neutral-400"
                  />
                )}
              </th>
            )}
            <Th col="repo" label="Repo" />
            {showOwner && <Th col="owner" label="Owner" />}
            <Th col="priority" label="Priority" />
            {show('language') && <Th col="language" label="Language" />}
            <th className="px-2 py-1.5 font-medium text-neutral-500">Tags</th>
            {show('pushed') && <Th col="pushed" label="Pushed" />}
            {show('stars') && <Th col="stars" label="★" className="text-right" />}
            {show('issues') && <Th col="issues" label="Issues" className="text-right" />}
            {show('forks') && <Th col="forks" label="Forks" className="text-right" />}
            <Th col="due" label="Due" />
            <Th col="checked" label="Checked" />
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((repo) => (
            <ListRow key={repo.id} repo={repo} showOwner={showOwner} fields={fields} selected={selectedIds ? selectedIds.has(repo.id) : false} onToggleSelect={onToggleSelect} {...rowProps} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
