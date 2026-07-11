import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { api } from '../api.js';
import { useDialog } from '../lib/useDialog.js';
import { devId } from '../lib/devIdOverlay.js';
import { cx } from '../lib/constants.js';
import { timeAgo } from '../lib/date.js';
import { activitySummary } from '../lib/activitySummary.js';

const SORT_KEYS = { repo: 'full_name', action: 'action', timestamp: 'created_at' };

function sortActivity(rows, col, dir) {
  const key = SORT_KEYS[col];
  const sorted = [...rows].sort((a, b) => {
    const av = a[key] ?? '';
    const bv = b[key] ?? '';
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

// Cross-repo, non-modal event log (#78): every tracked repo's triage
// activity in one sortable table, reached from its own header toolbar
// button rather than a dialog — see DESIGN.md → Event log view. Read-only
// over GET /api/activity; never triggers a GitHub sync.
export function EventLogView({ onClose }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const viewRef = useDialog(onClose);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.allActivity();
      setActivity(res.activity || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const onSort = (col) => {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const sorted = useMemo(() => sortActivity(activity, sortCol, sortDir), [activity, sortCol, sortDir]);

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

  return createPortal(
    <section
      {...devId('EventLogView')}
      ref={viewRef}
      role="region"
      aria-label="Event log"
      tabIndex={-1}
      className="fixed inset-x-4 top-6 z-30 mx-auto flex max-h-[88vh] max-w-4xl flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-100">Event log</h2>
          <p className="truncate text-[11px] text-neutral-500">
            {activity.length} event{activity.length === 1 ? '' : 's'} across all repos
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close event log"
          className="shrink-0 rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <p className="py-6 text-center text-xs text-neutral-600">loading...</p>
        ) : sorted.length === 0 ? (
          <p className="py-6 text-center text-xs text-neutral-700">no activity yet</p>
        ) : (
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-neutral-900">
              <tr className="border-b border-neutral-800">
                <Th col="repo" label="repo" />
                <Th col="action" label="action" />
                <Th col="timestamp" label="timestamp" className="text-right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <tr key={entry.id} className="border-b border-neutral-800/60 hover:bg-neutral-950/50">
                  <td className="truncate px-2 py-1.5 text-neutral-300">{entry.full_name || `repo ${entry.repo_id}`}</td>
                  <td className="px-2 py-1.5 text-neutral-200">{activitySummary(entry)}</td>
                  <td
                    className="px-2 py-1.5 text-right tabular-nums text-neutral-500"
                    title={new Date(entry.created_at).toLocaleString()}
                  >
                    {timeAgo(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>,
    document.body
  );
}
