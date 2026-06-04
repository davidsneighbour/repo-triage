import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { timeAgo, calendarLabel } from './lib/date.js';
import { defaultFilters, filterRepos, buildDayColumns, groupRepos, groupReposBy, collectTags, SORT_KEYS, GROUP_BY_KEYS } from './lib/board.js';
import { cx, ICON, SORT_LABELS, GROUP_BY_LABELS, DEFAULT_FIELDS } from './lib/constants.js';
import { EMPTY_DATA, readBoardCache, writeBoardCache } from './lib/boardCache.js';
import { Column } from './components/Column.jsx';
import { ListView } from './components/ListView.jsx';
import { HelpDialog } from './components/HelpDialog.jsx';
import { NoticesDialog } from './components/NoticesDialog.jsx';
import { ReportsDialog } from './components/ReportsDialog.jsx';
import { TagFilter } from './components/TagFilter.jsx';
import { PriorityFilter } from './components/PriorityFilter.jsx';
import { FieldsMenu } from './components/FieldsMenu.jsx';

// Colour/priority helpers now live in lib/constants; re-export for back-compat
// (e.g. tests importing `ownerColor` from this module).
export { ownerColor, tagColor, PRIORITY_LEVELS, PRIORITY_META } from './lib/constants.js';

export default function App() {
  const SyncIcon = ICON.sync;
  const SearchIcon = ICON.search;
  const HelpIcon = ICON.help;
  const IgnoredIcon = ICON.ignored;
  const NoticesIcon = ICON.notices;
  const ReportsIcon = ICON.reports;
  const DensityIcon = ICON.density;
  const SortIcon = ICON.sort;

  const [data, setData] = useState(() => readBoardCache() ?? EMPTY_DATA);
  const [loading, setLoading] = useState(() => !readBoardCache());
  const [showingCachedData, setShowingCachedData] = useState(() => Boolean(readBoardCache()));
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  // When the card menu is opened via the "+ tag" affordance we want it to land
  // straight on the tag input; null means a plain settings open.
  const [menuIntent, setMenuIntent] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Notices dialog scope: null (closed) | 'all' | a repo id.
  const [noticesScope, setNoticesScope] = useState(null);
  // Transient tag query: which tags to match and whether any/all.
  const [tagFilter, setTagFilter] = useState({ tags: [], mode: 'any' });
  // Independent priority filter: a list of selected levels (1|2|3, 0 = none).
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [reportsOpen, setReportsOpen] = useState(false);

  // "Show ignored" is a global visibility switch, deliberately separate from
  // the own/forks/archived inclusive filters and persisted under its own key.
  const SHOW_IGNORED_KEY = 'repo-triage-show-ignored';
  const [showIgnored, setShowIgnored] = useState(() => {
    try {
      return localStorage.getItem(SHOW_IGNORED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const toggleShowIgnored = () =>
    setShowIgnored((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SHOW_IGNORED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });

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

  // Card density (comfortable | compact), persisted.
  const DENSITY_KEY = 'repo-triage-density';
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const toggleDensity = () =>
    setDensity((prev) => {
      const next = prev === 'compact' ? 'comfortable' : 'compact';
      try {
        localStorage.setItem(DENSITY_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });

  // Within-column sort order (manual drag order by default), persisted.
  const SORT_KEY = 'repo-triage-sort';
  const [sortKey, setSortKey] = useState(() => {
    try {
      const v = localStorage.getItem(SORT_KEY);
      return SORT_KEYS.includes(v) ? v : 'manual';
    } catch {
      return 'manual';
    }
  });
  const changeSort = (next) => {
    setSortKey(SORT_KEYS.includes(next) ? next : 'manual');
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      /* ignore */
    }
  };

  // Card field visibility (all on by default), persisted.
  const FIELDS_KEY = 'repo-triage-fields';
  const [fields, setFields] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FIELDS_KEY) || '{}');
      return { ...DEFAULT_FIELDS, ...(stored && typeof stored === 'object' ? stored : {}) };
    } catch {
      return { ...DEFAULT_FIELDS };
    }
  });
  const toggleField = (key) =>
    setFields((prev) => {
      const next = { ...prev, [key]: !(prev[key] !== false) };
      try {
        localStorage.setItem(FIELDS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  // Board grouping: the day schedule (default) or by owner/tag/language.
  const GROUP_BY_STORAGE = 'repo-triage-group-by';
  const [groupBy, setGroupBy] = useState(() => {
    try {
      const v = localStorage.getItem(GROUP_BY_STORAGE);
      return GROUP_BY_KEYS.includes(v) ? v : 'day';
    } catch {
      return 'day';
    }
  });
  const changeGroupBy = (next) => {
    setGroupBy(GROUP_BY_KEYS.includes(next) ? next : 'day');
    try {
      localStorage.setItem(GROUP_BY_STORAGE, next);
    } catch {
      /* ignore */
    }
  };

  // Board (columns) vs list (sortable table) view, persisted.
  const VIEW_KEY = 'repo-triage-view';
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board';
    } catch {
      return 'board';
    }
  });
  const toggleView = () =>
    setView((prev) => {
      const next = prev === 'list' ? 'board' : 'list';
      try {
        localStorage.setItem(VIEW_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });

  const load = useCallback(async () => {
    try {
      const d = await api.list();
      // The server hasn't finished its first GitHub fetch yet and returned an
      // empty list. Don't blow away a populated cached board (or persist the
      // empty payload) — keep showing what we have and let the poll retry.
      const notReadyAndEmpty = !d.cacheReady && (!d.repos || d.repos.length === 0);
      setData((prev) => {
        if (notReadyAndEmpty && prev.repos.length > 0) {
          return { ...d, repos: prev.repos };
        }
        return d;
      });
      if (d.cacheReady) {
        setShowingCachedData(false);
        writeBoardCache(d);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the backend is still warming up its cache or actively syncing,
  // so a background GitHub fetch (startup or queued "sync") fills the board in
  // without a manual reload.
  useEffect(() => {
    if (!loading && (!data.cacheReady || data.syncing)) {
      const t = setTimeout(load, 2000);
      return () => clearTimeout(t);
    }
  }, [loading, data.cacheReady, data.syncing, load]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'F1') {
        event.preventDefault();
        setHelpOpen(true);
      }
      if (event.key === 'Escape') {
        setHelpOpen(false);
        setNoticesScope(null);
        setReportsOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Queue a background sync on the server and immediately re-read status. The
  // poll loop (driven by `syncing`) pulls in the refreshed repos when ready, so
  // the UI never blocks on the GitHub fetch.
  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.refresh();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const mutate = (fn) => fn().then(load);

  const onSetChecked = (id, daysAgo = 0) => mutate(() => api.setChecked(id, daysAgo));
  const onClearCheck = (id) => mutate(() => api.clearSchedule(id));
  const onSetPriority = (id, priority) => mutate(() => api.setPriority(id, priority));
  const onSetInactivity = (id, days) => mutate(() => api.setInactivity(id, days));
  const onSetIgnored = (id, ignored) => mutate(() => api.setIgnored(id, ignored));
  const onAddNotice = (id, body) => mutate(() => api.addNotice(id, body));
  const onViewNotices = (scope) => setNoticesScope(scope);
  const onAddTag = (id, tag) => mutate(() => api.addTag(id, tag));
  const onRemoveTag = (id, tag) => mutate(() => api.removeTag(id, tag));
  const onToggleMenu = (id, intent = null) => {
    // An explicit intent (the "+ tag" chip) always opens and focuses; a plain
    // gear click toggles the menu open/closed.
    setOpenMenuId((cur) => (intent ? id : cur === id ? null : id));
    setMenuIntent(intent);
  };

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
    return filterRepos(data.repos, q, filters, showIgnored, tagFilter, priorityFilter);
  }, [data.repos, q, filters, showIgnored, tagFilter, priorityFilter]);

  const availableTags = useMemo(() => collectTags(data.repos), [data.repos]);

  // Drop selected tags that no longer exist on any repo (e.g. after removing the
  // last use of a tag) so the filter can't get stuck on a phantom tag.
  useEffect(() => {
    setTagFilter((tf) => {
      if (tf.tags.length === 0) return tf;
      const avail = new Set(availableTags.map((t) => t.tag));
      const kept = tf.tags.filter((t) => avail.has(t));
      return kept.length === tf.tags.length ? tf : { ...tf, tags: kept };
    });
  }, [availableTags]);

  // Only surface the per-card owner indicator when the board mixes owners;
  // single-owner setups already name the owner in the header.
  const showOwners = useMemo(() => {
    const set = new Set();
    for (const r of data.repos) if (r.owner) set.add(r.owner);
    return set.size > 1;
  }, [data.repos]);

  const dayColumns = useMemo(() => {
    return buildDayColumns(data.defaultInactivityDays, calendarLabel);
  }, [data.defaultInactivityDays]);

  const groups = useMemo(() => {
    return groupRepos(filtered, dayColumns, sortKey);
  }, [filtered, dayColumns, sortKey]);

  // Generic columns for the non-day groupings (owner/tag/language).
  const groupedColumns = useMemo(() => {
    return groupBy === 'day' ? null : groupReposBy(filtered, groupBy, sortKey);
  }, [filtered, groupBy, sortKey]);

  const ownerLabel = data.owners?.length
    ? data.owners.length <= 3
      ? data.owners.map((o) => `@${o}`).join(', ')
      : `${data.owners.length} owners`
    : data.username
    ? `@${data.username}`
    : 'authenticated user';

  // Single polite live-region message; screen readers announce it on change.
  // Phrasing is kept distinct from the visible banners so it never duplicates
  // their text in the accessibility tree.
  const liveMessage = data.rateLimit?.authInvalid
    ? 'Authentication failed — update your GitHub token'
    : refreshing || data.syncing
    ? 'Syncing repositories with GitHub'
    : loading
    ? 'Loading board'
    : data.lastError
    ? `Sync failed: ${data.lastError}`
    : showingCachedData
    ? 'Showing cached board while refreshing'
    : `Board ready, ${filtered.length} repositories shown`;

  const todayColumn = dayColumns[0];
  const futureColumns = dayColumns.slice(1);

  const cardProps = {
    menuOpenId: openMenuId,
    menuIntent,
    showOwner: showOwners,
    density,
    fields,
    onToggleMenu,
    onDragStartCard,
    onDropOnCard,
    onSetChecked,
    onClearCheck,
    onSetPriority,
    onSetInactivity,
    onSetIgnored,
    onAddNotice,
    onViewNotices,
    onAddTag,
    onRemoveTag,
    allTags: availableTags.map((t) => t.tag),
    defaultInactivity: data.defaultInactivityDays,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </div>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight text-neutral-100">repo.triage</h1>
          <span className="text-xs text-neutral-600">
            {ownerLabel} · {data.repos.length} repos · review cycle {data.defaultInactivityDays}d
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
            disabled={refreshing || data.syncing || data.rateLimit?.authInvalid || data.rateLimit?.remaining === 0}
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            <SyncIcon className={cx('h-3.5 w-3.5', (refreshing || data.syncing) && 'animate-spin')} aria-hidden="true" />
            {refreshing || data.syncing ? 'syncing...' : 'sync GitHub'}
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
            className="w-64 rounded-md border border-neutral-800 bg-neutral-950 pl-7 pr-3 py-1.5 text-xs text-neutral-100 outline-hidden focus:border-neutral-600"
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
        <div className="flex items-center gap-2 border-l border-neutral-800 pl-3">
          <button
            onClick={toggleView}
            aria-pressed={view === 'list'}
            title={view === 'list' ? 'List view (click for board)' : 'Board view (click for list)'}
            className={cx(
              'rounded-md border px-2 py-1 text-[11px] transition-colors',
              view === 'list'
                ? 'border-neutral-600 bg-neutral-800 text-neutral-200'
                : 'border-neutral-800 bg-transparent text-neutral-600'
            )}
          >
            {view === 'list' ? 'list' : 'board'}
          </button>
          <label className={cx('flex items-center gap-1 text-[11px] text-neutral-600', view === 'list' && 'opacity-40')}>
            <span className="sr-only">Group board by</span>
            <span aria-hidden="true" className="text-[10px] uppercase tracking-wider">group</span>
            <select
              value={groupBy}
              onChange={(e) => changeGroupBy(e.target.value)}
              disabled={view === 'list'}
              aria-label="Group board by"
              className={cx(
                'rounded-md border px-1.5 py-1 text-[11px] outline-hidden transition-colors focus:border-neutral-500 disabled:cursor-not-allowed',
                groupBy === 'day'
                  ? 'border-neutral-800 bg-transparent text-neutral-500'
                  : 'border-neutral-600 bg-neutral-800 text-neutral-200'
              )}
            >
              {GROUP_BY_KEYS.map((k) => (
                <option key={k} value={k}>{GROUP_BY_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <button
            onClick={toggleDensity}
            aria-pressed={density === 'compact'}
            title={density === 'compact' ? 'Compact cards (click for comfortable)' : 'Comfortable cards (click for compact)'}
            className={cx(
              'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
              density === 'compact'
                ? 'border-neutral-600 bg-neutral-800 text-neutral-200'
                : 'border-neutral-800 bg-transparent text-neutral-600'
            )}
          >
            <DensityIcon className="h-3 w-3" aria-hidden="true" />
            compact
          </button>
          <label className="flex items-center gap-1 text-[11px] text-neutral-600">
            <span className="sr-only">Sort cards within columns</span>
            <SortIcon className="h-3 w-3" aria-hidden="true" />
            <select
              value={sortKey}
              onChange={(e) => changeSort(e.target.value)}
              aria-label="Sort cards within columns"
              className={cx(
                'rounded-md border px-1.5 py-1 text-[11px] outline-hidden transition-colors focus:border-neutral-500',
                sortKey === 'manual'
                  ? 'border-neutral-800 bg-transparent text-neutral-500'
                  : 'border-neutral-600 bg-neutral-800 text-neutral-200'
              )}
            >
              {SORT_KEYS.map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <FieldsMenu fields={fields} onToggle={toggleField} />
          <button
            onClick={toggleShowIgnored}
            aria-pressed={showIgnored}
            className={cx(
              'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
              showIgnored
                ? 'border-neutral-600 bg-neutral-800 text-neutral-200'
                : 'border-neutral-800 bg-transparent text-neutral-600'
            )}
          >
            <IgnoredIcon className="h-3 w-3" aria-hidden="true" />
            show ignored
          </button>
          <TagFilter available={availableTags} value={tagFilter} onChange={setTagFilter} />
          <PriorityFilter value={priorityFilter} onChange={setPriorityFilter} />
          <button
            onClick={() => setReportsOpen(true)}
            className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
          >
            <ReportsIcon className="h-3 w-3" aria-hidden="true" />
            reports
          </button>
          <button
            onClick={() => setNoticesScope('all')}
            className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
          >
            <NoticesIcon className="h-3 w-3" aria-hidden="true" />
            notices
          </button>
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
            {!data.tokenPresent && ' — no token found. Set GITHUB_TOKEN in .env, or run `gh auth login`.'}
          </div>
        )}
        {data.sourceWarnings?.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            {data.sourceWarnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
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
        ) : view === 'list' ? (
          <ListView repos={filtered} {...cardProps} />
        ) : (
          <div role="group" aria-label="Repository board" aria-busy={data.syncing || undefined} className="flex min-h-0 flex-1 gap-4 overflow-hidden">
            {groupBy === 'day' ? (
              <>
                {todayColumn && (
                  <div className="sticky left-0 z-10 flex bg-neutral-950/95 pr-2 backdrop-blur-xs">
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
              </>
            ) : (
              <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-2">
                <div className="flex h-full min-w-max gap-4 pr-4">
                  {groupedColumns.length === 0 ? (
                    <div className="grid flex-1 place-items-center text-center text-xs text-neutral-700">no repositories to group</div>
                  ) : (
                    groupedColumns.map((col) => (
                      <Column key={col.key} col={col} repos={col.repos} schedulable={false} onDropColumn={() => {}} {...cardProps} />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {reportsOpen && <ReportsDialog onClose={() => setReportsOpen(false)} />}
      {noticesScope != null && (
        <NoticesDialog
          scope={noticesScope}
          repos={data.repos}
          onClose={() => setNoticesScope(null)}
          onScopeChange={setNoticesScope}
          onChanged={load}
        />
      )}
    </div>
  );
}
