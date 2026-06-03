import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, CircleHelp, GitFork, RefreshCw, Search, Settings2, User, X } from 'lucide-react';
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from './api.js';
import { timeAgo, calendarLabel } from './lib/date.js';
import { defaultFilters, filterRepos, repoMatchesQuery, buildDayColumns, groupRepos } from './lib/board.js';
import helpMarkdown from './help.md?raw';

const ACCENT = {
  neutral: { dot: 'bg-neutral-500', head: 'text-neutral-300', edge: 'border-neutral-800' },
  rose: { dot: 'bg-rose-500', head: 'text-rose-300', edge: 'border-rose-500/30' },
  amber: { dot: 'bg-amber-500', head: 'text-amber-300', edge: 'border-amber-500/30' },
  sky: { dot: 'bg-sky-500', head: 'text-sky-300', edge: 'border-sky-500/30' },
};

const cx = (...a) => a.filter(Boolean).join(' ');
const BOARD_CACHE_KEY = 'repo-triage-board-cache-v1';

const EMPTY_DATA = {
  repos: [],
  cacheReady: false,
  defaultInactivityDays: 7,
  lastFetch: null,
  username: null,
  tokenPresent: true,
  lastError: null,
  rateLimit: null,
};

function readBoardCache() {
  try {
    const raw = localStorage.getItem(BOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.payload || !Array.isArray(parsed.payload.repos)) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeBoardCache(payload) {
  localStorage.setItem(
    BOARD_CACHE_KEY,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      payload,
    })
  );
}

const ICON = {
  sync: RefreshCw,
  search: Search,
  settings: Settings2,
  help: CircleHelp,
  own: User,
  forks: GitFork,
  archived: Archive,
};

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

function CardMenu({ repo, anchorRef, defaultInactivity, onSetChecked, onClearCheck, onSetInactivity, onClose }) {
  const [days, setDays] = useState(repo.inactivity_days ?? '');
  const [pos, setPos] = useState(null);

  // Anchor the popover to the trigger via fixed positioning so the column's
  // overflow-y-auto scroll area never clips it.
  useEffect(() => {
    const el = anchorRef?.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      const width = 256;
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [anchorRef]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className="fixed z-20 w-64 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-2xl"
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      >
        <p className="px-1 pb-1 text-[10px] uppercase tracking-widest text-neutral-500">Review timing</p>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => {
              onSetChecked(repo.id, 0);
              onClose();
            }}
            className="rounded-md bg-neutral-800 py-1 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
          >
            Checked now
          </button>
          <button
            onClick={() => {
              onSetChecked(repo.id, defaultInactivity);
              onClose();
            }}
            className="rounded-md bg-rose-500/20 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
          >
            Move to Today
          </button>
          <button
            onClick={() => {
              onClearCheck(repo.id);
              onClose();
            }}
            className="col-span-2 rounded-md bg-neutral-800 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
          >
            Clear check date
          </button>
        </div>

        <div className="mt-2 border-t border-neutral-800 pt-2">
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Review every (days)</label>
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
              onClick={() => {
                onSetInactivity(repo.id, days === '' ? null : Number(days));
                onClose();
              }}
              className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
            >
              Save
            </button>
          </div>
          <p className="mt-1 px-1 text-[10px] text-neutral-600">Blank = default ({defaultInactivity}d)</p>
        </div>
      </div>
    </>,
    document.body
  );
}

function HelpDialog({ onClose }) {
  const [mermaidError, setMermaidError] = useState(null);
  const mermaidNodes = useMemo(() => [], []);

  useEffect(() => {
    let cancelled = false;

    const renderMermaid = async () => {
      if (!mermaidNodes.length) {
        setMermaidError(null);
        return;
      }

      try {
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
        mermaidNodes.forEach((node, index) => {
          node.removeAttribute('data-processed');
          node.id = `help-mermaid-${index}-${Date.now()}`;
        });
        await mermaid.run({ nodes: mermaidNodes });
        if (!cancelled) setMermaidError(null);
      } catch {
        if (!cancelled) {
          setMermaidError('Unable to render Mermaid diagram. Markdown help is still available.');
        }
      }
    };

    renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [mermaidNodes]);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section className="fixed inset-x-4 top-6 z-40 mx-auto max-h-[88vh] max-w-3xl overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900">
        <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Help</h2>
            <p className="text-[11px] text-neutral-500">Press Esc to close</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
            aria-label="Close help"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <div className="max-h-[calc(88vh-64px)] overflow-auto px-4 py-3 text-xs text-neutral-300">
          {mermaidError && (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              {mermaidError}
            </div>
          )}

          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h3 className="mb-2 text-sm font-semibold text-neutral-100">{children}</h3>,
              h2: ({ children }) => <h4 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">{children}</h4>,
              p: ({ children }) => <p className="mb-2 leading-relaxed text-neutral-300">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 text-neutral-300">{children}</ul>,
              li: ({ children }) => <li>{children}</li>,
              code: ({ className, children }) => {
                const match = /language-(\w+)/.exec(className || '');
                const code = String(children).replace(/\n$/, '');

                if (match?.[1] === 'mermaid') {
                  return (
                    <div className="mb-3 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3">
                      <div
                        ref={(node) => {
                          if (node && !mermaidNodes.includes(node)) mermaidNodes.push(node);
                        }}
                        className="mermaid text-[11px]"
                      >
                        {code}
                      </div>
                    </div>
                  );
                }

                return (
                  <code className="rounded bg-neutral-950 px-1 py-0.5 text-[11px] text-neutral-200">
                    {children}
                  </code>
                );
              },
            }}
          >
            {helpMarkdown}
          </ReactMarkdown>
        </div>
      </section>
    </>
  );
}

function RepoCard({ repo, column, menuOpenId, onToggleMenu, onDragStartCard, onDropOnCard, ...handlers }) {
  const SettingsIcon = ICON.settings;
  const menuButtonRef = useRef(null);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStartCard(e, repo.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onDropOnCard(e, repo.id, column.daysAgoTarget);
      }}
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
          ref={menuButtonRef}
          onClick={() => onToggleMenu(repo.id)}
          className="shrink-0 rounded-md px-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
          aria-label="Open repository settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
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
        <span>{repo.checkedAgeDays == null ? 'not checked yet' : `checked ${repo.checkedAgeDays}d ago`}</span>
      </div>

      <div className="mt-1 text-[11px] text-neutral-500">
        {repo.needsCheckToday ? (
          <span className="text-rose-300">review today</span>
        ) : (
          <span>review in {repo.dueInDays}d</span>
        )}
      </div>

      {menuOpenId === repo.id && <CardMenu repo={repo} anchorRef={menuButtonRef} onClose={() => onToggleMenu(repo.id)} {...handlers} />}
    </div>
  );
}

function Column({ col, repos, onDropColumn, ...cardProps }) {
  const acc = ACCENT[col.accent];
  const ColSearchIcon = ICON.search;
  const [over, setOver] = useState(false);
  const [cq, setCq] = useState('');

  const visible = useMemo(() => repos.filter((r) => repoMatchesQuery(r, cq)), [repos, cq]);
  const filtering = cq.trim() !== '';

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
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

      <label className="relative mb-2 block">
        <ColSearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-600" aria-hidden="true" />
        <input
          value={cq}
          onChange={(e) => setCq(e.target.value)}
          placeholder="filter column..."
          aria-label={`Filter ${col.title} column`}
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 pl-7 pr-2 py-1 text-[11px] text-neutral-100 outline-none focus:border-neutral-600"
        />
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const id = Number(e.dataTransfer.getData('text/plain'));
          if (id) onDropColumn(id, col.daysAgoTarget);
        }}
        className={cx(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-dashed p-2 transition-colors',
          over ? 'border-neutral-500 bg-neutral-900/60' : 'border-neutral-800/60'
        )}
      >
        {visible.map((r) => (
          <RepoCard key={r.id} repo={r} column={col} {...cardProps} />
        ))}
        {repos.length === 0 && (
          <div className="grid flex-1 place-items-center text-center text-xs text-neutral-700">drag here</div>
        )}
        {repos.length > 0 && visible.length === 0 && (
          <div className="grid flex-1 place-items-center text-center text-xs text-neutral-700">no matches</div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const SyncIcon = ICON.sync;
  const SearchIcon = ICON.search;
  const HelpIcon = ICON.help;

  const [data, setData] = useState(() => readBoardCache() ?? EMPTY_DATA);
  const [loading, setLoading] = useState(() => !readBoardCache());
  const [showingCachedData, setShowingCachedData] = useState(() => Boolean(readBoardCache()));
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // ---- Visibility filters (persisted in localStorage) --------------------
  const FILTER_KEY = 'repo-triage-filters';
  // Three inclusive categories — a repo is shown if it matches ANY checked category.
  // own      = not a fork AND not archived
  // forks    = is a fork (regardless of archive state)
  // archived = is archived (regardless of fork state)
  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_KEY));
      // Migrate old 4-key format by dropping unknown keys
      if (saved && typeof saved === 'object') {
        const migrated = { ...defaultFilters };
        if ('showOwn' in saved) migrated.showOwn = Boolean(saved.showOwn);
        if ('showForks' in saved) migrated.showForks = Boolean(saved.showForks);
        if ('showArchived' in saved) migrated.showArchived = Boolean(saved.showArchived);
        return migrated;
      }
    } catch { /* ignore */ }
    return defaultFilters;
  });

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(FILTER_KEY, JSON.stringify(next));
      return next;
    });

  const showAll = () => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(defaultFilters));
    setFilters(defaultFilters);
  };

  const allShown = Object.values(filters).every(Boolean);

  const load = useCallback(async () => {
    try {
      const d = await api.list();
      setData(d);
      setShowingCachedData(false);
      writeBoardCache(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && !data.cacheReady) {
      const t = setTimeout(load, 2000);
      return () => clearTimeout(t);
    }
  }, [loading, data.cacheReady, load]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'F1') {
        event.preventDefault();
        setHelpOpen(true);
      }
      if (event.key === 'Escape') {
        setHelpOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.refresh();
    } finally {
      setRefreshing(false);
      await load();
    }
  };

  const mutate = (fn) => fn().then(load);

  const onSetChecked = (id, daysAgo = 0) => mutate(() => api.setChecked(id, daysAgo));
  const onClearCheck = (id) => mutate(() => api.setPriority(id, null));
  const onSetInactivity = (id, days) => mutate(() => api.setInactivity(id, days));
  const onToggleMenu = (id) => setOpenMenuId((cur) => (cur === id ? null : id));

  const onDragStartCard = (e, id) => {
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDropColumn = (id, daysAgoTarget) => onSetChecked(id, daysAgoTarget);
  const onDropOnCard = (e, targetId, daysAgoTarget) => {
    const id = Number(e.dataTransfer.getData('text/plain'));
    if (id && id !== targetId) onSetChecked(id, daysAgoTarget);
  };

  const filtered = useMemo(() => {
    return filterRepos(data.repos, q, filters);
  }, [data.repos, q, filters]);

  const dayColumns = useMemo(() => {
    return buildDayColumns(data.defaultInactivityDays, calendarLabel);
  }, [data.defaultInactivityDays]);

  const groups = useMemo(() => {
    return groupRepos(filtered, dayColumns);
  }, [filtered, dayColumns]);

  const todayColumn = dayColumns[0];
  const futureColumns = dayColumns.slice(1);

  const cardProps = {
    menuOpenId: openMenuId,
    onToggleMenu,
    onDragStartCard,
    onDropOnCard,
    onSetChecked,
    onClearCheck,
    onSetInactivity,
    defaultInactivity: data.defaultInactivityDays,
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight text-neutral-100">repo.triage</h1>
          <span className="text-xs text-neutral-600">
            {data.username ? `@${data.username}` : 'authenticated user'} · {data.repos.length} repos · review cycle {data.defaultInactivityDays}d
          </span>
        </div>
        <div className="flex items-center gap-3">
          {data.rateLimit?.remaining != null && (
            <span
              title={`GitHub API: ${data.rateLimit.used ?? '?'}/${data.rateLimit.limit ?? '?'} used · resets ${data.rateLimit.reset ? new Date(data.rateLimit.reset * 1000).toLocaleTimeString() : '?'}`}
              className={cx(
                'text-[11px] tabular-nums',
                data.rateLimit.remaining === 0
                  ? 'text-rose-400'
                  : data.rateLimit.remaining < 100
                  ? 'text-amber-400'
                  : 'text-neutral-600'
              )}
            >
              API {data.rateLimit.remaining}/{data.rateLimit.limit ?? '?'}
            </span>
          )}
          {data.lastFetch && <span className="text-[11px] text-neutral-600">synced {timeAgo(data.lastFetch)}</span>}
          <button
            onClick={() => setHelpOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
            aria-label="Open help"
          >
            <HelpIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Help
          </button>
          <button
            onClick={refresh}
            disabled={refreshing || data.rateLimit?.authInvalid || data.rateLimit?.remaining === 0}
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            <SyncIcon className={cx('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
            {refreshing ? 'syncing...' : 'sync GitHub'}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-900 px-5 py-2">
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter repos..."
            aria-label="Search repositories"
            className="w-64 rounded-md border border-neutral-800 bg-neutral-950 pl-7 pr-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-neutral-600"
          />
        </label>
        <div className="flex items-center gap-1 border-l border-neutral-800 pl-3">
          <span className="mr-1 text-[10px] uppercase tracking-widest text-neutral-600">show</span>
          {[
            { key: 'showOwn', label: 'own', icon: ICON.own },
            { key: 'showForks', label: 'forks', icon: ICON.forks },
            { key: 'showArchived', label: 'archived', icon: ICON.archived },
          ].map(({ key, label, icon: FilterIcon }) => (
            <label
              key={key}
              className={cx(
                'flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors select-none',
                filters[key]
                  ? 'border-neutral-600 bg-neutral-800 text-neutral-200'
                  : 'border-neutral-800 bg-transparent text-neutral-600'
              )}
            >
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(e) => setFilter(key, e.target.checked)}
                className="sr-only"
              />
              <FilterIcon className="h-3 w-3" aria-hidden="true" />
              {label}
            </label>
          ))}
          {!allShown && (
            <button
              onClick={showAll}
              className="ml-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
            >
              show all
            </button>
          )}
        </div>
      </div>

      <main className="flex flex-1 flex-col overflow-hidden p-5">
        {data.rateLimit?.authInvalid && (
          <div className="mb-4 rounded-lg border border-rose-500/60 bg-rose-500/15 px-4 py-3 text-xs text-rose-200">
            <strong>GitHub token is invalid or expired.</strong> Update GITHUB_TOKEN in your .env file and restart the server.
          </div>
        )}
        {data.rateLimit?.remaining === 0 && !data.rateLimit?.authInvalid && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            GitHub API rate limit exhausted. Resets at{' '}
            {data.rateLimit.reset ? new Date(data.rateLimit.reset * 1000).toLocaleTimeString() : 'unknown'}.
            Manual sync is disabled until the limit resets.
          </div>
        )}
        {data.lastError && !data.rateLimit?.authInvalid && data.rateLimit?.remaining !== 0 && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            GitHub error: {data.lastError}
            {!data.tokenPresent && ' - no GITHUB_TOKEN found. Start with: docker compose --env-file ~/.env up'}
          </div>
        )}
        {showingCachedData && (
          <div className="mb-4 rounded-lg border border-neutral-700 bg-neutral-900/70 px-4 py-3 text-xs text-neutral-300">
            Showing cached board while refreshing from GitHub.
          </div>
        )}
        {loading || (!data.cacheReady && !showingCachedData) ? (
          <div className="grid h-40 place-items-center text-center text-sm text-neutral-600">
            <div>
              <div>{loading ? 'loading...' : 'fetching repositories from GitHub...'}</div>
              {!loading && !data.cacheReady && <div className="mt-1 text-xs text-neutral-700">the server is still talking to the GitHub API</div>}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
            {todayColumn && (
              <div className="sticky left-0 z-10 flex bg-neutral-950/95 pr-2 backdrop-blur-sm">
                <Column col={todayColumn} repos={groups[todayColumn.key] || []} onDropColumn={onDropColumn} {...cardProps} />
              </div>
            )}
            <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-2">
              <div className="flex h-full min-w-max gap-4 pr-4">
                {futureColumns.map((col) => (
                  <Column key={col.key} col={col} repos={groups[col.key] || []} onDropColumn={onDropColumn} {...cardProps} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
