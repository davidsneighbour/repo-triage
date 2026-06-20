import { useState } from 'react';
import { useIsMobile } from '../lib/useIsMobile.js';
import { cx, PRIORITY_FILTER_OPTIONS } from '../lib/constants.js';

// Action bar shown while one or more repos are selected. Each action applies to
// the whole selection (via App's bulkActions) and then clears it. On mobile it
// pins to the bottom edge as a thumb-reachable action bar (see DESIGN.md →
// Layout → Responsive / mobile).
export function BulkBar({ count, actions, columns = [], onClear }) {
  const [tag, setTag] = useState('');
  const isMobile = useIsMobile();

  const submitTag = () => {
    const v = tag.trim();
    if (v) {
      actions.tag(v);
      setTag('');
    }
  };

  const submitUntag = () => {
    const v = tag.trim();
    if (v) {
      actions.untag(v);
      setTag('');
    }
  };

  const btn = 'rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-200 hover:bg-neutral-800';

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cx(
        'flex flex-wrap items-center gap-2 border border-neutral-700 bg-neutral-900/80 px-3 py-2',
        isMobile
          ? 'fixed inset-x-0 bottom-0 z-30 rounded-t-lg border-t'
          : 'mb-3 rounded-lg'
      )}
    >
      <span className="text-[11px] font-semibold text-neutral-200" aria-live="polite">
        {count} selected
      </span>
      <span className="mx-1 h-4 w-px bg-neutral-800" aria-hidden="true" />
      <button className={btn} onClick={actions.checkedNow}>Checked now</button>
      {columns.length > 0 ? (
        <label className="flex items-center gap-1">
          <span className="text-[11px] text-neutral-400">Move to</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value !== '') actions.moveTo(Number(e.target.value));
            }}
            aria-label="Move selected to column"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-200 outline-hidden focus:border-neutral-500"
          >
            <option value="" disabled>column…</option>
            {columns.map((c) => (
              <option key={c.key} value={c.daysAgoTarget}>{c.title}</option>
            ))}
          </select>
        </label>
      ) : (
        <button className={btn} onClick={actions.moveToday}>Move to Today</button>
      )}
      <button className={btn} onClick={actions.clear}>Clear check</button>
      <label className="flex items-center gap-1">
        <span className="text-[11px] text-neutral-400">Priority</span>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value !== '') actions.priority(e.target.value === 'null' ? null : Number(e.target.value));
          }}
          aria-label="Set priority for selected repos"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-200 outline-hidden focus:border-neutral-500"
        >
          <option value="" disabled>set…</option>
          {PRIORITY_FILTER_OPTIONS.map((o) => (
            <option key={o.level} value={o.level === 0 ? 'null' : o.level}>{o.label}</option>
          ))}
        </select>
      </label>
      <button className={btn} onClick={actions.ignore}>Ignore</button>
      <button className={btn} onClick={actions.unignore}>Unignore</button>
      <span className="ml-1 flex items-center gap-1">
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitTag();
            }
          }}
          placeholder="tag..."
          aria-label="Bulk tag"
          className="w-24 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] text-neutral-100 outline-hidden focus:border-neutral-500"
        />
        <button className={btn} disabled={tag.trim() === ''} onClick={submitTag}>
          Add tag
        </button>
        <button className={btn} disabled={tag.trim() === ''} onClick={submitUntag}>
          Remove tag
        </button>
      </span>
      <button
        onClick={onClear}
        className="ml-auto rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-200"
      >
        Deselect
      </button>
    </div>
  );
}
