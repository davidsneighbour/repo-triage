import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

// --- Column model -----------------------------------------------------------
const COLUMNS = [
  { key: 'unsorted', title: 'Inbox', subtitle: 'untriaged', priority: null, accent: 'neutral' },
  { key: 'p1', title: 'P1', subtitle: 'now', priority: 1, accent: 'rose' },
  { key: 'p2', title: 'P2', subtitle: 'soon', priority: 2, accent: 'amber' },
  { key: 'p3', title: 'P3', subtitle: 'later', priority: 3, accent: 'sky' },
  { key: 'look-again', title: 'Look again', subtitle: 'auto-degraded', priority: 4, accent: 'violet', readOnly: true },
];

// Tailwind needs static class strings, so accents are mapped explicitly.
const ACCENT = {
  neutral: { dot: 'bg-neutral-500', head: 'text-neutral-300', edge: 'border-neutral-800' },
  rose: { dot: 'bg-rose-500', head: 'text-rose-300', edge: 'border-rose-500/30' },
  amber: { dot: 'bg-amber-500', head: 'text-amber-300', edge: 'border-amber-500/30' },
  sky: { dot: 'bg-sky-500', head: 'text-sky-300', edge: 'border-sky-500/30' },
  violet: { dot: 'bg-violet-500', head: 'text-violet-300', edge: 'border-violet-500/30' },
};

const cx = (...a) => a.filter(Boolean).join(' ');

function timeAgo(iso) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const units = [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [u, secs] of units) if (s >= secs) return `${Math.floor(s / secs)}${u} ago`;
  return 'just now';
}

// --- Small UI atoms ---------------------------------------------------------
function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-neutral-800 text-neutral-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
    sky: 'bg-sky-500/15 text-sky-300',
    violet: 'bg-violet-500/15 text-violet-300',
    rose: 'bg-rose-500/15 text-rose-300',
  };
  return <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-medium', tones[tone])}>{children}</span>;
}

function CardMenu({ repo, defaultInactivity, onSetPriority, onSetInactivity, onTouch, onClose }) {
  const [days, setDays] = useState(repo.inactivity_days ?? '');
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-2 top-9 z-20 w-56 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
        <p className="px-1 pb-1 text-[10px] uppercase tracking-widest text-neutral-500">Set priority</p>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3].map((p) => (
            <button
              key={p}
              onClick={() => { onSetPriority(repo.id, p); onClose(); }}
              className={cx(
                'rounded-md py-1 text-xs font-semibold transition-colors',
                repo.priority === p ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
              )}
            >
              P{p}
            </button>
          ))}
          <button
            onClick={() => { onSetPriority(repo.id, null); onClose(); }}
            className="rounded-md bg-neutral-800 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
          >
            Inbox
          </button>
        </div>

        {repo.column === 'look-again' && (
          <button
            onClick={() => { onTouch(repo.id); onClose(); }}
            className="mt-2 w-full rounded-md bg-violet-500/20 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/30"
          >
            I looked — keep priority
          </button>
        )}

        <div className="mt-2 border-t border-neutral-800 pt-2">
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Degrade after (days)</label>
          <div className="mt-1 flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={days}
              placeholder={String(defaultInactivity)}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-neutral-500"
            />
            <button
              onClick={() => { onSetInactivity(repo.id, days === '' ? null : Number(days)); onClose(); }}
              className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              Save
            </button>
          </div>
          <p className="mt-1 px-1 text-[10px] text-neutral-600">Blank = default ({defaultInactivity}d)</p>
        </div>
      </div>
    </>
  );
}

function RepoCard({ repo, column, menuOpenId, onToggleMenu, onDragStartCard, onDropOnCard, ...handlers }) {
  const overdue = repo.column === 'look-again';
  return (
    <div
      draggable
      onDragStart={(e) => onDragStartCard(e, repo.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); e.preventDefault(); onDropOnCard(e, repo.id, column.priority); }}
      className="group relative rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 hover:border-neutral-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 cursor-grab active:cursor-grabbing">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium text-neutral-100 hover:text-white hover:underline"
          >
            {repo.name}
          </a>
          {repo.description && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{repo.description}</p>}
        </div>
        <button
          onClick={() => onToggleMenu(repo.id)}
          className="shrink-0 rounded-md px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
          aria-label="Settings"
        >
          ⋯
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={repo.private ? 'amber' : 'emerald'}>{repo.private ? 'private' : 'public'}</Badge>
        {repo.archived ? <Badge tone="neutral">archived</Badge> : <Badge tone="sky">live</Badge>}
        {repo.fork && <Badge tone="neutral">fork</Badge>}
        {repo.language && <Badge tone="violet">{repo.language}</Badge>}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
        <span>pushed {timeAgo(repo.pushed_at)}</span>
        {repo.priority != null &&
          (overdue ? (
            <span className="text-violet-300">review overdue</span>
          ) : (
            <span>degrades in {repo.daysLeft}d</span>
          ))}
      </div>

      {menuOpenId === repo.id && (
        <CardMenu repo={repo} onClose={() => onToggleMenu(repo.id)} {...handlers} />
      )}
    </div>
  );
}

function Column({ col, repos, onDropColumn, ...cardProps }) {
  const acc = ACCENT[col.accent];
  const [over, setOver] = useState(false);
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className={cx('mb-2 flex items-center justify-between rounded-lg border bg-neutral-900/40 px-3 py-2', acc.edge)}>
        <div className="flex items-center gap-2">
          <span className={cx('h-2 w-2 rounded-full', acc.dot)} />
          <span className={cx('text-sm font-semibold', acc.head)}>{col.title}</span>
          <span className="text-[11px] text-neutral-600">{col.subtitle}</span>
        </div>
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">{repos.length}</span>
      </div>

      <div
        onDragOver={(e) => { if (!col.readOnly) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (col.readOnly) return;
          const id = Number(e.dataTransfer.getData('text/plain'));
          if (id) onDropColumn(id, col.priority);
        }}
        className={cx(
          'flex min-h-[140px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors',
          over ? 'border-neutral-500 bg-neutral-900/60' : 'border-neutral-800/60'
        )}
      >
        {repos.map((r) => (
          <RepoCard key={r.id} repo={r} column={col} {...cardProps} />
        ))}
        {repos.length === 0 && (
          <div className="grid flex-1 place-items-center text-center text-xs text-neutral-700">
            {col.readOnly ? 'nothing overdue' : 'drag here'}
          </div>
        )}
      </div>
    </div>
  );
}

// --- App --------------------------------------------------------------------
export default function App() {
  const [data, setData] = useState({ repos: [], defaultInactivityDays: 7, lastFetch: null, username: null, tokenPresent: true, lastError: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [hideArchived, setHideArchived] = useState(false);
  const [hideForks, setHideForks] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api.list();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try { await api.refresh(); } finally { setRefreshing(false); await load(); }
  };

  const mutate = (fn) => fn().then(load);

  const onSetPriority = (id, priority) => mutate(() => api.setPriority(id, priority));
  const onSetInactivity = (id, days) => mutate(() => api.setInactivity(id, days));
  const onTouch = (id) => mutate(() => api.touch(id));
  const onToggleMenu = (id) => setOpenMenuId((cur) => (cur === id ? null : id));

  const onDragStartCard = (e, id) => {
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
  };
  // Dropping anywhere in a column = "move to state x".
  const onDropColumn = (id, priority) => { if (priority !== 4) onSetPriority(id, priority); };
  // Dropping onto a card behaves the same (move to that card's column).
  const onDropOnCard = (e, targetId, priority) => {
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (id && id !== targetId && priority !== 4) onSetPriority(id, priority);
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.repos.filter((r) => {
      if (hideArchived && r.archived) return false;
      if (hideForks && r.fork) return false;
      if (term && !`${r.name} ${r.description || ''} ${r.language || ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data.repos, q, hideArchived, hideForks]);

  const groups = useMemo(() => {
    const g = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const r of filtered) (g[r.column] || g.unsorted).push(r);
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    return g;
  }, [filtered]);

  const cardProps = { menuOpenId, onToggleMenu, onDragStartCard, onDropOnCard, onSetPriority, onSetInactivity, onTouch, defaultInactivity: data.defaultInactivityDays };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight text-neutral-100">repo<span className="text-rose-400">·</span>triage</h1>
          <span className="text-xs text-neutral-600">
            {data.username ? `@${data.username}` : 'authenticated user'} · {data.repos.length} repos · degrade @ {data.defaultInactivityDays}d
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data.lastFetch && <span className="text-[11px] text-neutral-600">synced {timeAgo(data.lastFetch)}</span>}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            {refreshing ? 'syncing…' : 'sync GitHub'}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-900 px-5 py-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter repos…"
          className="w-64 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-neutral-600"
        />
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <input type="checkbox" checked={hideArchived} onChange={(e) => setHideArchived(e.target.checked)} className="accent-rose-500" />
          hide archived
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-400">
          <input type="checkbox" checked={hideForks} onChange={(e) => setHideForks(e.target.checked)} className="accent-rose-500" />
          hide forks
        </label>
      </div>

      {/* Board */}
      <main className="flex-1 overflow-auto p-5">
        {data.lastError && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            GitHub error: {data.lastError}
            {!data.tokenPresent && ' — no GITHUB_TOKEN found. Start with: docker compose --env-file ~/.env up'}
          </div>
        )}
        {loading ? (
          <div className="grid h-40 place-items-center text-sm text-neutral-600">loading repositories…</div>
        ) : (
          <div className="flex gap-4">
            {COLUMNS.map((col) => (
              <Column key={col.key} col={col} repos={groups[col.key]} onDropColumn={onDropColumn} {...cardProps} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
