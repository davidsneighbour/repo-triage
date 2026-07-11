import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import { useDialog } from '../lib/useDialog.js';
import { devId } from '../lib/devIdOverlay.js';
import { cx } from '../lib/constants.js';
import { timeAgo } from '../lib/date.js';
import { sortNotices } from '../lib/board.js';
import { activitySummary } from '../lib/activitySummary.js';

export function NoticesDialog({ scope, repos, onClose, onScopeChange, onChanged, onDeleted }) {
  const [notices, setNotices] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState('notices');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('date');
  const [dir, setDir] = useState('desc');
  const [confirmId, setConfirmId] = useState(null);
  const dialogRef = useDialog(onClose);

  const isAll = scope === 'all';
  const repo = isAll ? null : repos.find((r) => r.id === scope);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const noticeRes = isAll ? await api.allNotices() : await api.repoNotices(scope);
      setNotices(noticeRes.notices || []);
      if (!isAll) {
        const actRes = await api.getActivity(scope);
        setActivity(actRes.activity || []);
      }
    } finally {
      setLoading(false);
    }
  }, [isAll, scope]);

  useEffect(() => {
    reload();
    if (isAll) setTab('notices');
  }, [reload, isAll]);

  const sorted = useMemo(() => sortNotices(notices, sort, dir), [notices, sort, dir]);

  const removeNotice = async (noticeId) => {
    setConfirmId(null);
    const notice = notices.find((n) => n.id === noticeId);
    await api.deleteNotice(noticeId);
    await reload();
    onChanged?.();
    onDeleted?.(notice);
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section
        {...devId('NoticesDialog')}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notices-dialog-title"
        tabIndex={-1}
        className="fixed inset-x-4 top-6 z-40 mx-auto flex max-h-[88vh] max-w-3xl flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 id="notices-dialog-title" className="text-sm font-semibold text-neutral-100">Notices</h2>
            <p className="truncate text-[11px] text-neutral-500">
              {isAll ? 'all repositories' : repo?.full_name || repo?.name || 'repository'}
              {!isAll && (
                <button onClick={() => onScopeChange('all')} className="ml-2 text-neutral-400 underline hover:text-neutral-200">
                  show all repos
                </button>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isAll && (
              <div className="flex overflow-hidden rounded-md border border-neutral-700 text-[11px]">
                <button
                  onClick={() => setTab('notices')}
                  className={cx('px-2 py-1', tab === 'notices' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
                >
                  Notices
                </button>
                <button
                  onClick={() => setTab('activity')}
                  className={cx('px-2 py-1', tab === 'activity' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
                >
                  Activity
                </button>
              </div>
            )}
            {tab === 'notices' && (
              <>
                <div className="flex overflow-hidden rounded-md border border-neutral-700 text-[11px]">
                  <button
                    onClick={() => setSort('date')}
                    className={cx('px-2 py-1', sort === 'date' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
                  >
                    date
                  </button>
                  <button
                    onClick={() => setSort('repo')}
                    className={cx('px-2 py-1', sort === 'repo' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
                  >
                    repo
                  </button>
                </div>
                <button
                  onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  aria-label="Toggle sort direction"
                  className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] tabular-nums text-neutral-300 hover:bg-neutral-800"
                >
                  {dir === 'asc' ? '↑ asc' : '↓ desc'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Close notices"
              className="rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="overflow-auto px-4 py-3">
          {loading ? (
            <p className="py-6 text-center text-xs text-neutral-600">loading...</p>
          ) : tab === 'activity' ? (
            activity.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-700">no activity yet</p>
            ) : (
              <ul className="space-y-1.5">
                {activity.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 rounded-md bg-neutral-950 px-3 py-1.5">
                    <span className="text-xs text-neutral-300">{activitySummary(e)}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-neutral-500" title={new Date(e.created_at).toLocaleString()}>
                      {timeAgo(e.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : sorted.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-700">no notices yet</p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 rounded-md bg-neutral-950 px-3 py-2">
                  <div className="min-w-0">
                    {isAll && <p className="truncate text-[11px] font-medium text-neutral-300">{n.full_name || `repo ${n.repo_id}`}</p>}
                    <p className="whitespace-pre-wrap break-words text-xs text-neutral-200">{n.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] tabular-nums text-neutral-500" title={new Date(n.created_at).toLocaleString()}>
                      {timeAgo(n.created_at)}
                    </span>
                    {confirmId === n.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => removeNotice(n.id)}
                          className="rounded-sm bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/30"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          aria-label="Cancel delete"
                          className="rounded-sm px-1 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-200"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmId(n.id)} aria-label="Delete notice" className="text-neutral-600 hover:text-rose-300">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
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
