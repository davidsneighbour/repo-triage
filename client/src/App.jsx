import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { api } from "./api.js";
import { BulkBar } from "./components/BulkBar.jsx";
import { Column } from "./components/Column.jsx";
import { DevIdOverlay } from "./components/DevIdOverlay.jsx";
import { EventLogView } from "./components/EventLogView.jsx";
import { FieldsMenu } from "./components/FieldsMenu.jsx";
import { HelpDialog } from "./components/HelpDialog.jsx";
import { IssuesDialog } from "./components/IssuesDialog.jsx";
import { IssuesOverviewDialog } from "./components/IssuesOverviewDialog.jsx";
import { ListView } from "./components/ListView.jsx";
import { MobileActionSheet } from "./components/MobileActionSheet.jsx";
import { MobileBoard } from "./components/MobileBoard.jsx";
import { NoticesDialog } from "./components/NoticesDialog.jsx";
import { PriorityFilter } from "./components/PriorityFilter.jsx";
import { ReportsDialog } from "./components/ReportsDialog.jsx";
import { SettingsDialog } from "./components/SettingsDialog.jsx";
import { StatusDialog } from "./components/StatusDialog.jsx";
import { TagFilter } from "./components/TagFilter.jsx";
import { Toast } from "./components/Toast.jsx";
import {
  buildDayColumns,
  collectTags,
  defaultFilters,
  filterRepos,
  GROUP_BY_KEYS,
  groupRepos,
  groupReposBy,
  SORT_KEYS,
} from "./lib/board.js";
import {
  EMPTY_DATA,
  readBoardCache,
  writeBoardCache,
} from "./lib/boardCache.js";
import {
  cx,
  DEFAULT_FIELDS,
  GROUP_BY_LABELS,
  ICON,
  SORT_LABELS,
} from "./lib/constants.js";
import { calendarLabel, timeAgo } from "./lib/date.js";
import { useIsMobile } from "./lib/useIsMobile.js";

// Colour/priority helpers now live in lib/constants; re-export for back-compat
// (e.g. tests importing `ownerColor` from this module).
// biome-ignore lint/performance/noBarrelFile: single intentional back-compat re-export, not a barrel file
export {
  ownerColor,
  PRIORITY_LEVELS,
  PRIORITY_META,
  tagColor,
} from "./lib/constants.js";

export default function App() {
  const SyncIcon = ICON.sync;
  const SearchIcon = ICON.search;
  const HelpIcon = ICON.help;
  const InfoIcon = ICON.info;
  const IgnoredIcon = ICON.ignored;
  const NoticesIcon = ICON.notices;
  const ReportsIcon = ICON.reports;
  const IssuesIcon = ICON.issues;
  const ActivityIcon = ICON.activity;
  const DensityIcon = ICON.density;
  const SortIcon = ICON.sort;
  const MoreIcon = ICON.more;
  const ListIcon = ICON.list;
  const BoardIcon = ICON.board;
  const SettingsIcon = ICON.settings;

  const [data, setData] = useState(() => readBoardCache() ?? EMPTY_DATA);
  const [loading, setLoading] = useState(() => !readBoardCache());
  const [showingCachedData, setShowingCachedData] = useState(() =>
    Boolean(readBoardCache()),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  // When the card menu is opened via the "+ tag" affordance we want it to land
  // straight on the tag input; null means a plain settings open.
  const [menuIntent, setMenuIntent] = useState(null);
  // Multi-select: a Set of selected repo ids for bulk actions.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // Transient toast: { message, undo? }. Auto-dismissed after a few seconds.
  const [toast, setToast] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Notices dialog scope: null (closed) | 'all' | a repo id.
  const [noticesScope, setNoticesScope] = useState(null);
  // Issues dialog scope: null (closed) | a repo id.
  const [issuesRepoId, setIssuesRepoId] = useState(null);
  const [issuesOverviewOpen, setIssuesOverviewOpen] = useState(false);
  const [eventLogOpen, setEventLogOpen] = useState(false);
  // Transient tag query: which tags to match and whether any/all.
  const [tagFilter, setTagFilter] = useState({ tags: [], mode: "any" });
  // Independent priority filter: a list of selected levels (1|2|3, 0 = none).
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [remoteSettings, setRemoteSettings] = useState(null);
  const [tagRules, setTagRules] = useState([]);
  const [settingsSets, setSettingsSets] = useState([]);
  const [lastExport, setLastExport] = useState(null);
  // Mobile overflow: the collapsed toolbar controls live in a bottom action sheet.
  const [actionsOpen, setActionsOpen] = useState(false);

  // "Show ignored" is a global visibility switch, deliberately separate from
  // the own/forks/archived inclusive filters and persisted under its own key.
  const SHOW_IGNORED_KEY = "repo-triage-show-ignored";
  const [showIgnored, setShowIgnored] = useState(() => {
    try {
      return localStorage.getItem(SHOW_IGNORED_KEY) === "true";
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
  const FILTER_KEY = "repo-triage-filters";
  // Three inclusive categories — a repo is shown if it matches ANY checked category.
  // own      = not a fork AND not archived
  // forks    = is a fork (regardless of archive state)
  // archived = is archived (regardless of fork state)
  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_KEY));
      // Migrate old 4-key format by dropping unknown keys
      if (saved && typeof saved === "object") {
        const migrated = { ...defaultFilters };
        if ("showOwn" in saved) migrated.showOwn = Boolean(saved.showOwn);
        if ("showForks" in saved) migrated.showForks = Boolean(saved.showForks);
        if ("showArchived" in saved)
          migrated.showArchived = Boolean(saved.showArchived);
        return migrated;
      }
    } catch {
      /* ignore */
    }
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

  // "Solo" a single category: turn the other two off and this one on.
  const soloFilter = (key) => {
    const next = Object.fromEntries(
      Object.keys(defaultFilters).map((k) => [k, k === key]),
    );
    localStorage.setItem(FILTER_KEY, JSON.stringify(next));
    setFilters(next);
  };

  // Double-tap detection for touch devices (mirrors onDoubleClick for mouse).
  const lastPillTapRef = useRef({ key: null, time: 0 });
  const DOUBLE_TAP_MS = 350;
  const handlePillTouchEnd = (key) => {
    const now = Date.now();
    const last = lastPillTapRef.current;
    if (last.key === key && now - last.time < DOUBLE_TAP_MS) {
      lastPillTapRef.current = { key: null, time: 0 };
      soloFilter(key);
    } else {
      lastPillTapRef.current = { key, time: now };
    }
  };

  const allShown = Object.values(filters).every(Boolean);

  // Card density (comfortable | compact), persisted.
  const DENSITY_KEY = "repo-triage-density";
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) === "compact"
        ? "compact"
        : "comfortable";
    } catch {
      return "comfortable";
    }
  });
  const toggleDensity = () =>
    setDensity((prev) => {
      const next = prev === "compact" ? "comfortable" : "compact";
      try {
        localStorage.setItem(DENSITY_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });

  // Within-column sort order (manual drag order by default), persisted.
  const SORT_KEY = "repo-triage-sort";
  const [sortKey, setSortKey] = useState(() => {
    try {
      const v = localStorage.getItem(SORT_KEY);
      return SORT_KEYS.includes(v) ? v : "manual";
    } catch {
      return "manual";
    }
  });
  const changeSort = (next) => {
    setSortKey(SORT_KEYS.includes(next) ? next : "manual");
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      /* ignore */
    }
  };

  // Card field visibility (all on by default), persisted.
  const FIELDS_KEY = "repo-triage-fields";
  const [fields, setFields] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FIELDS_KEY) || "{}");
      return {
        ...DEFAULT_FIELDS,
        ...(stored && typeof stored === "object" ? stored : {}),
      };
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
  const stableFields = useMemo(
    () => fields,
    [
      fields.language,
      fields.pushed,
      fields.stars,
      fields.issues,
      fields.forks,
      fields.notice,
      fields.open_prs,
      fields.latest_release,
      fields.last_commit,
      fields.ci_status,
    ],
  );

  // Board grouping: the day schedule (default) or by owner/tag/language.
  const GROUP_BY_STORAGE = "repo-triage-group-by";
  const [groupBy, setGroupBy] = useState(() => {
    try {
      const v = localStorage.getItem(GROUP_BY_STORAGE);
      return GROUP_BY_KEYS.includes(v) ? v : "day";
    } catch {
      return "day";
    }
  });
  const changeGroupBy = (next) => {
    setGroupBy(GROUP_BY_KEYS.includes(next) ? next : "day");
    try {
      localStorage.setItem(GROUP_BY_STORAGE, next);
    } catch {
      /* ignore */
    }
  };

  // Board (columns) vs list (sortable table) view, persisted.
  const VIEW_KEY = "repo-triage-view";
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board";
    } catch {
      return "board";
    }
  });
  // Switching view re-renders the whole board/list subtree, which can take a
  // beat on large repo sets. Mark it as a transition so the click stays
  // responsive and we can surface a "switching" indicator while React renders
  // the new view in the background.
  const [viewPending, startViewTransition] = useTransition();
  const toggleView = () => {
    const next = view === "list" ? "board" : "list";
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
    startViewTransition(() => setView(next));
  };

  // ---- Server-side prefs sync -----------------------------------------------
  // Tracks whether we've finished the one-time GET from /api/prefs (success or
  // error). The write-back effect is gated on this flag to avoid overwriting
  // server-side prefs with stale localStorage values on the very first render.
  const [serverPrefsLoaded, setServerPrefsLoaded] = useState(false);

  useEffect(() => {
    api
      .getPrefs?.()
      ?.then((d) => {
        if (d?.prefs) {
          const p = d.prefs;
          if (p.density != null)
            setDensity(p.density === "compact" ? "compact" : "comfortable");
          if (p.sort != null)
            setSortKey(SORT_KEYS.includes(p.sort) ? p.sort : "manual");
          if (p.view != null) setView(p.view === "list" ? "list" : "board");
          if (p.groupBy != null)
            setGroupBy(GROUP_BY_KEYS.includes(p.groupBy) ? p.groupBy : "day");
          if (p.fields != null && typeof p.fields === "object")
            setFields({ ...DEFAULT_FIELDS, ...p.fields });
          if (p.filters != null && typeof p.filters === "object")
            setFilters({ ...defaultFilters, ...p.filters });
          if (p.showIgnored != null) setShowIgnored(Boolean(p.showIgnored));
          if (p.tagFilter != null && typeof p.tagFilter === "object") {
            setTagFilter({
              tags: Array.isArray(p.tagFilter.tags) ? p.tagFilter.tags : [],
              mode: p.tagFilter.mode === "all" ? "all" : "any",
            });
          }
          if (Array.isArray(p.priorityFilter))
            setPriorityFilter(
              p.priorityFilter
                .filter((v) => [0, 1, 2, 3].includes(Number(v)))
                .map(Number),
            );
        }
        setServerPrefsLoaded(true);
      })
      ?.catch(() => setServerPrefsLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!serverPrefsLoaded) return;
    api
      .putPrefs?.({
        density,
        sort: sortKey,
        view,
        groupBy,
        fields,
        filters,
        showIgnored,
        tagFilter,
        priorityFilter,
      })
      ?.catch(() => {
        /* no-op */
      });
  }, [
    serverPrefsLoaded,
    density,
    sortKey,
    view,
    groupBy,
    fields,
    filters,
    showIgnored,
    tagFilter,
    priorityFilter,
  ]);

  // Tracks the undo_log entry ID for the currently-shown toast (if persisted).
  const pendingUndoIdRef = useRef(null);

  const showToast = useCallback((message, undo = null, ops = null) => {
    pendingUndoIdRef.current = null;
    setToast({ message, undo });
    if (ops?.length) {
      api
        .createUndo?.(message, ops)
        .then(({ id }) => {
          pendingUndoIdRef.current = id;
        })
        .catch(() => {
          /* no-op */
        });
    }
  }, []);

  // Auto-dismiss the toast after a few seconds (re-armed whenever it changes).
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => {
      const undoId = pendingUndoIdRef.current;
      pendingUndoIdRef.current = null;
      if (undoId)
        api.discardUndo?.(undoId).catch(() => {
          /* no-op */
        });
      setToast(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const lastLoadAt = useRef(0);
  const prevDay0Ids = useRef(null);
  const colFilterCache = useRef({});
  const [syncDiffSuffix, setSyncDiffSuffix] = useState("");

  const [tagRegistry, setTagRegistry] = useState([]);

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([api.list(), api.getTags()]);
      // The server hasn't finished its first GitHub fetch yet and returned an
      // empty list. Don't blow away a populated cached board (or persist the
      // empty payload) — keep showing what we have and let the poll retry.
      const notReadyAndEmpty =
        !d.cacheReady && (!d.repos || d.repos.length === 0);
      setData((prev) => {
        if (notReadyAndEmpty && prev.repos.length > 0) {
          return { ...d, repos: prev.repos };
        }
        return d;
      });
      setTagRegistry(t?.tags || []);
      if (d.cacheReady) {
        setShowingCachedData(false);
        writeBoardCache(d);
      }
    } finally {
      setLoading(false);
      lastLoadAt.current = Date.now();
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Settings-set presets are static config, not board state — fetched once.
  // Optional-chained so App still mounts cleanly in tests whose api.js mock
  // doesn't stub this endpoint (the feature is additive, not load-bearing).
  useEffect(() => {
    Promise.resolve(api.getSettingsSets?.())
      .then((d) => setSettingsSets(d?.presets ?? []))
      .catch(() => {
        /* no-op */
      });
  }, []);

  // After each board update, compute a brief sync diff so AT users know which
  // repos moved to Today. Skipped on the initial load (prevDay0Ids starts null).
  // Cleared when syncing starts so stale diffs don't repeat on filter changes.
  useEffect(() => {
    if (data.syncing || loading) {
      setSyncDiffSuffix("");
      return;
    }
    if (!data.repos.length) return;
    const currentDay0 = new Set(
      data.repos.filter((r) => r.boardOffset === 0).map((r) => r.id),
    );
    if (prevDay0Ids.current !== null) {
      const movedIn = [...currentDay0].filter(
        (id) => !prevDay0Ids.current.has(id),
      ).length;
      const newRepos = data.repos.filter(
        (r) => !prevDay0Ids.current.has(r.id) && !currentDay0.has(r.id),
      ).length;
      const parts = [];
      if (movedIn > 0)
        parts.push(`${movedIn} repo${movedIn !== 1 ? "s" : ""} moved to Today`);
      if (newRepos > 0)
        parts.push(`${newRepos} new repo${newRepos !== 1 ? "s" : ""} added`);
      setSyncDiffSuffix(parts.length ? ` — ${parts.join(", ")}` : "");
    }
    prevDay0Ids.current = currentDay0;
  }, [data.repos, data.syncing, loading]);

  // Steady-state 30-second poll. Skipped if a load (including mutation-triggered
  // reloads) happened within the last 10 seconds to avoid double-fetching after
  // user actions.
  useEffect(() => {
    const POLL_MS = 30_000;
    const DEBOUNCE_MS = 10_000;
    const t = setInterval(() => {
      if (Date.now() - lastLoadAt.current >= DEBOUNCE_MS) load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // On startup, restore the most recent persisted undo entry (< 5 min old).
  useEffect(() => {
    api
      .getUndoLog?.()
      .then(({ entries }) => {
        if (!entries?.length) return;
        const e = entries[0];
        if (Date.now() - new Date(e.created_at).getTime() > 5 * 60 * 1000)
          return;
        pendingUndoIdRef.current = e.id;
        setToast({
          message: e.label,
          undoHandlesCleanup: true,
          undo: () =>
            api.executeUndo(e.id).then(() => {
              pendingUndoIdRef.current = null;
              load();
            }),
        });
      })
      .catch(() => {
        /* no-op */
      });
    // Intentionally runs once on mount — load is stable after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const inInput =
        event.target.tagName === "INPUT" ||
        event.target.tagName === "TEXTAREA" ||
        event.target.isContentEditable;
      if (event.key === "F1") {
        event.preventDefault();
        setHelpOpen(true);
      }
      if (event.key === "," && !inInput && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setSettingsOpen((o) => !o);
      }
      if (event.key === "Escape") {
        setHelpOpen(false);
        setNoticesScope(null);
        setReportsOpen(false);
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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

  const openSettings = () => {
    api
      .getSettings()
      .then((d) => setRemoteSettings(d))
      .catch(() => {
        /* no-op */
      });
    api
      .getTagRules()
      .then((d) => setTagRules(d.rules ?? []))
      .catch(() => {
        /* no-op */
      });
    api
      .getLastExport?.()
      .then((d) => setLastExport(d.lastExport ?? null))
      .catch(() => {
        /* no-op */
      });
    setSettingsOpen(true);
  };

  const saveSettings = async (values) => {
    await api.putSettings(values);
    const d = await api.getSettings();
    setRemoteSettings(d);
    setSettingsOpen(false);
    await load();
  };

  // Card-facing handlers are wrapped in useCallback so their identity is stable
  // across re-renders. That lets the memoised RepoCard skip re-rendering when an
  // unrelated bit of state (e.g. a selection toggle) changes — keeping selection
  // instant even on large boards.
  const mutate = useCallback((fn) => fn().then(load), [load]);

  const onSetChecked = useCallback(
    (id, daysAgo = 0) => mutate(() => api.setChecked(id, daysAgo)),
    [mutate],
  );
  const onClearCheck = useCallback(
    (id) => {
      const repo = data.repos.find((r) => r.id === id);
      const prioritySetAt = repo?.priority_set_at ?? null;
      const checkedAt = repo?.checked_at ?? null;
      const result = mutate(() => api.clearSchedule(id));
      showToast(
        "Check cleared",
        () => mutate(() => api.restoreState(id, prioritySetAt, checkedAt)),
        [
          {
            type: "restoreState",
            repoId: id,
            fullName: repo?.full_name ?? null,
            prioritySetAt,
            checkedAt,
          },
        ],
      );
      return result;
    },
    [mutate, data.repos, showToast],
  );
  const onSetPriority = useCallback(
    (id, priority) => mutate(() => api.setPriority(id, priority)),
    [mutate],
  );
  const onSetInactivity = useCallback(
    (id, days) => mutate(() => api.setInactivity(id, days)),
    [mutate],
  );
  const onSnooze = useCallback(
    (id, days) => api.snooze(id, days).then(load),
    [load],
  );
  const onSetIgnored = useCallback(
    (id, ignored) => {
      const result = mutate(() => api.setIgnored(id, ignored));
      // Ignoring hides the repo — offer a one-click undo. (Unignoring needs none.)
      if (ignored) {
        const repo = data.repos.find((r) => r.id === id);
        const name = repo?.name ?? "repo";
        showToast(
          `Ignored ${name}`,
          () => mutate(() => api.setIgnored(id, false)),
          [
            {
              type: "setIgnored",
              repoId: id,
              fullName: repo?.full_name ?? null,
              ignored: false,
            },
          ],
        );
      }
      return result;
    },
    [mutate, data.repos, showToast],
  );
  const onAddNotice = useCallback(
    (id, body) => mutate(() => api.addNotice(id, body)),
    [mutate],
  );
  const onGhPrs = useCallback((id) => api.ghPrs(id), []);
  const onGhCreateIssue = useCallback(
    (id, title, body) => api.ghCreateIssue(id, title, body),
    [],
  );
  const onGetConformance = useCallback(
    (id, presetId) => api.getRepoConformance(id, presetId),
    [],
  );
  const onViewNotices = useCallback((scope) => setNoticesScope(scope), []);
  const onViewIssues = useCallback((repoId) => setIssuesRepoId(repoId), []);
  const onAddTag = useCallback(
    (id, tag) => mutate(() => api.addTag(id, tag)),
    [mutate],
  );
  const onRemoveTag = useCallback(
    (id, tag) => mutate(() => api.removeTag(id, tag)),
    [mutate],
  );
  const onAddFlag = useCallback(
    (id, flag) => mutate(() => api.addFlag(id, flag)),
    [mutate],
  );
  const onRemoveFlag = useCallback(
    (id, flag) => mutate(() => api.removeFlag(id, flag)),
    [mutate],
  );
  // Delete a tag from every repo that carries it (from the tag-filter dropdown).
  const onDeleteTag = useCallback(
    (tag, resetCheck) => mutate(() => api.deleteTag(tag, resetCheck)),
    [mutate],
  );
  const onCreateTag = useCallback(
    (tag) => mutate(() => api.createTag(tag)),
    [mutate],
  );
  const onRenameTag = useCallback(
    (tag, newTag) => mutate(() => api.renameTag(tag, newTag)),
    [mutate],
  );
  const onToggleMenu = useCallback((id, intent = null) => {
    // An explicit intent (the "+ tag" chip) always opens and focuses; a plain
    // gear click toggles the menu open/closed.
    setOpenMenuId((cur) => (intent ? id : cur === id ? null : id));
    setMenuIntent(intent);
  }, []);

  const onToggleSelect = useCallback(
    (id) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const clearSelection = () => setSelectedIds(new Set());
  // Bulk select/deselect a set of ids at once (column / list "select all").
  const onSelectMany = useCallback(
    (ids, selected) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (selected) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    [],
  );

  // Apply an action to every selected repo, then refresh once. `ids` is captured
  // up front so the set can be cleared immediately for snappy feedback.
  const bulkRequest = async (action, params = {}) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    clearSelection();
    await api.bulk(action, ids, params);
    await load();
  };
  const bulkUnignore = (ids) => api.bulk("unignore", ids).then(load);
  const bulkActions = {
    checkedNow: () => bulkRequest("check", { daysAgo: 0 }),
    moveToday: () =>
      bulkRequest("check", { daysAgo: data.defaultInactivityDays }),
    // Move the selection to any day column (by its check-age target).
    moveTo: (daysAgoTarget) => bulkRequest("check", { daysAgo: daysAgoTarget }),
    clear: () => bulkRequest("clear"),
    ignore: () => {
      const ids = [...selectedIds];
      const repoMap = Object.fromEntries(
        data.repos.map((r) => [r.id, r.full_name]),
      );
      const result = bulkRequest("ignore");
      if (ids.length) {
        const ops = ids.map((id) => ({
          type: "setIgnored",
          repoId: id,
          fullName: repoMap[id] ?? null,
          ignored: false,
        }));
        showToast(
          `${ids.length} repo${ids.length === 1 ? "" : "s"} ignored`,
          () => bulkUnignore(ids),
          ops,
        );
      }
      return result;
    },
    unignore: () => bulkRequest("unignore"),
    tag: (tag) => bulkRequest("tag", { tag }),
    untag: (tag) => bulkRequest("untag", { tag }),
    priority: (level) => bulkRequest("priority", { priority: level }),
  };

  const onDragStartCard = useCallback((e, id) => {
    e.dataTransfer.setData("text/plain", String(id));
    e.dataTransfer.effectAllowed = "move";
  }, []);
  const onDropColumn = useCallback(
    (id, daysAgoTarget) => onSetChecked(id, daysAgoTarget),
    [onSetChecked],
  );
  const onDropOnCard = useCallback(
    (e, targetId, daysAgoTarget) => {
      const id = Number(e.dataTransfer.getData("text/plain"));
      if (id && id !== targetId) onSetChecked(id, daysAgoTarget);
    },
    [onSetChecked],
  );

  const filtered = useMemo(() => {
    return filterRepos(
      data.repos,
      q,
      filters,
      showIgnored,
      tagFilter,
      priorityFilter,
    );
  }, [data.repos, q, filters, showIgnored, tagFilter, priorityFilter]);

  const availableTags = useMemo(() => collectTags(data.repos), [data.repos]);
  const allTags = useMemo(
    () => availableTags.map((t) => t.tag),
    [availableTags],
  );

  // Drop selected ids that no longer exist after a refresh so the bulk bar can't
  // act on (or count) repos that have gone away.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const exist = new Set(data.repos.map((r) => r.id));
      const next = new Set();
      for (const id of prev) if (exist.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [data.repos]);

  // Drop selected tags that are no longer registered (e.g. after a delete or
  // rename) so the filter can't get stuck on a phantom tag. A tag with zero
  // current usage stays valid as long as it's still in the registry.
  useEffect(() => {
    setTagFilter((tf) => {
      if (tf.tags.length === 0) return tf;
      const avail = new Set(tagRegistry.map((t) => t.tag));
      const kept = tf.tags.filter((t) => avail.has(t));
      return kept.length === tf.tags.length ? tf : { ...tf, tags: kept };
    });
  }, [tagRegistry]);

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

  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  const announceMove = useCallback(
    (id, daysAgoTarget) => {
      const repo = data.repos.find((r) => r.id === id);
      const col =
        dayColumns.find((c) => c.daysAgoTarget === daysAgoTarget) ??
        dayColumns[0];
      if (repo && col)
        setMoveAnnouncement(`${repo.name} moved to ${col.title}`);
    },
    [data.repos, dayColumns],
  );

  const groups = useMemo(() => {
    return groupRepos(filtered, dayColumns, sortKey);
  }, [filtered, dayColumns, sortKey]);

  // Generic columns for the non-day groupings (owner/tag/language).
  const groupedColumns = useMemo(() => {
    return groupBy === "day" ? null : groupReposBy(filtered, groupBy, sortKey);
  }, [filtered, groupBy, sortKey]);

  // Single polite live-region message; screen readers announce it on change.
  // Phrasing is kept distinct from the visible banners so it never duplicates
  // their text in the accessibility tree.
  const liveMessage = data.rateLimit?.authInvalid
    ? "Authentication failed — update your GitHub token"
    : refreshing || data.syncing
      ? "Syncing repositories with GitHub"
      : loading
        ? "Loading board"
        : data.lastError
          ? `Sync failed: ${data.lastError}`
          : showingCachedData
            ? "Showing cached board while refreshing"
            : `Board ready, ${filtered.length} repositories shown${syncDiffSuffix}`;

  const todayColumn = dayColumns[0];
  const futureColumns = dayColumns.slice(1);

  const uncheckedColumn = useMemo(
    () => ({
      key: "unchecked",
      title: "Unchecked",
      subtitle: "never reviewed",
      daysAgoTarget: 0,
      accent: "neutral",
    }),
    [],
  );

  const uncheckedRepos = useMemo(() => {
    if (groupBy !== "day") return [];
    return filtered.filter((r) => r.column === "unchecked");
  }, [filtered, groupBy]);

  // Below the mobile breakpoint the board collapses to a single column chosen
  // from the DayPicker. Build one unified column list covering both the day
  // schedule and the owner/tag/language groupings so MobileBoard is agnostic.
  const isMobile = useIsMobile();
  const mobileColumns = useMemo(() => {
    if (groupBy === "day") {
      const dayCols = dayColumns.map((col) => ({
        ...col,
        repos: groups[col.key] || [],
        schedulable: true,
      }));
      if (uncheckedRepos.length > 0) {
        return [
          { ...uncheckedColumn, repos: uncheckedRepos, schedulable: false },
          ...dayCols,
        ];
      }
      return dayCols;
    }
    return (groupedColumns || []).map((col) => ({
      ...col,
      schedulable: false,
    }));
  }, [
    groupBy,
    dayColumns,
    groups,
    groupedColumns,
    uncheckedRepos,
    uncheckedColumn,
  ]);

  const issuesRepo =
    issuesRepoId != null ? data.repos.find((r) => r.id === issuesRepoId) : null;

  const cardProps = {
    menuOpenId: openMenuId,
    menuIntent,
    showOwner: showOwners,
    density,
    fields: stableFields,
    onToggleMenu,
    onDragStartCard,
    onDropOnCard,
    onSetChecked,
    onClearCheck,
    onSetPriority,
    onSetInactivity,
    onSnooze,
    onSetIgnored,
    onAddNotice,
    onViewNotices,
    onAddTag,
    onRemoveTag,
    onAddFlag,
    onRemoveFlag,
    selectedIds,
    onToggleSelect,
    onSelectMany,
    allTags,
    defaultInactivity: data.defaultInactivityDays,
    onGhPrs,
    onGhCreateIssue,
    onViewIssues,
    settingsSets,
    onGetConformance,
    onAnnounceMove: announceMove,
    colFilterCache,
    isGlobalFiltered: q.trim() !== "",
  };

  // The inclusive own/forks/archived filter pills. Rendered inline in the
  // desktop toolbar, or inside the mobile action sheet (same controls).
  const filterPills = (
    <>
      <span className="mr-1 text-[10px] uppercase tracking-widest text-neutral-600">
        show
      </span>
      {[
        { key: "showOwn", label: "own", icon: ICON.own },
        { key: "showForks", label: "forks", icon: ICON.forks },
        { key: "showArchived", label: "archived", icon: ICON.archived },
      ].map(({ key, label, icon: FilterIcon }) => (
        <label
          key={key}
          title={`Double-click (or double-tap) to show only ${label}`}
          onDoubleClick={() => soloFilter(key)}
          onTouchEnd={() => handlePillTouchEnd(key)}
          className={cx(
            "flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors select-none",
            filters[key]
              ? "border-neutral-600 bg-neutral-800 text-neutral-200"
              : "border-neutral-800 bg-transparent text-neutral-600",
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
    </>
  );

  // The view-option controls (view toggle, group-by, density, sort, fields,
  // show-ignored, tag/priority filters, reports, notices). Same dual placement.
  const optionControls = (
    <>
      <button
        onClick={toggleView}
        title={view === "list" ? "Switch to board view" : "Switch to list view"}
        aria-label={
          view === "list" ? "Switch to board view" : "Switch to list view"
        }
        aria-busy={viewPending || undefined}
        className="flex items-center rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
      >
        {viewPending ? (
          <SyncIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : view === "list" ? (
          <BoardIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ListIcon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      <label
        className={cx(
          "flex items-center gap-1 text-[11px] text-neutral-600",
          view === "list" && "opacity-40",
        )}
      >
        <span className="sr-only">Group board by</span>
        <span
          aria-hidden="true"
          className="text-[10px] uppercase tracking-wider"
        >
          group
        </span>
        <select
          value={groupBy}
          onChange={(e) => changeGroupBy(e.target.value)}
          disabled={view === "list"}
          aria-label="Group board by"
          className={cx(
            "rounded-md border px-1.5 py-1 text-[11px] outline-hidden transition-colors focus:border-neutral-500 disabled:cursor-not-allowed",
            groupBy === "day"
              ? "border-neutral-800 bg-transparent text-neutral-500"
              : "border-neutral-600 bg-neutral-800 text-neutral-200",
          )}
        >
          {GROUP_BY_KEYS.map((k) => (
            <option key={k} value={k}>
              {GROUP_BY_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={toggleDensity}
        aria-pressed={density === "compact"}
        title={
          density === "compact"
            ? "Compact cards (click for comfortable)"
            : "Comfortable cards (click for compact)"
        }
        className={cx(
          "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
          density === "compact"
            ? "border-neutral-600 bg-neutral-800 text-neutral-200"
            : "border-neutral-800 bg-transparent text-neutral-600",
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
            "rounded-md border px-1.5 py-1 text-[11px] outline-hidden transition-colors focus:border-neutral-500",
            sortKey === "manual"
              ? "border-neutral-800 bg-transparent text-neutral-500"
              : "border-neutral-600 bg-neutral-800 text-neutral-200",
          )}
        >
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <FieldsMenu fields={fields} onToggle={toggleField} />
      <button
        onClick={toggleShowIgnored}
        aria-pressed={showIgnored}
        className={cx(
          "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
          showIgnored
            ? "border-neutral-600 bg-neutral-800 text-neutral-200"
            : "border-neutral-800 bg-transparent text-neutral-600",
        )}
      >
        <IgnoredIcon className="h-3 w-3" aria-hidden="true" />
        show ignored
      </button>
      <TagFilter
        available={tagRegistry}
        value={tagFilter}
        onChange={setTagFilter}
        onDelete={onDeleteTag}
        onCreate={onCreateTag}
        onRename={onRenameTag}
      />
      <PriorityFilter value={priorityFilter} onChange={setPriorityFilter} />
      <button
        onClick={() => setReportsOpen(true)}
        className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
      >
        <ReportsIcon className="h-3 w-3" aria-hidden="true" />
        reports
      </button>
      <button
        onClick={() => setNoticesScope("all")}
        className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
      >
        <NoticesIcon className="h-3 w-3" aria-hidden="true" />
        notices
      </button>
      <button
        onClick={() => setIssuesOverviewOpen(true)}
        className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
      >
        <IssuesIcon className="h-3 w-3" aria-hidden="true" />
        issues
      </button>
      <button
        onClick={() => setEventLogOpen(true)}
        className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
      >
        <ActivityIcon className="h-3 w-3" aria-hidden="true" />
        activity
      </button>
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </div>
      <div
        className="sr-only"
        role="status"
        aria-live="assertive"
        aria-atomic="true"
      >
        {moveAnnouncement}
      </div>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 px-5 py-3">
        <h1 className="text-base font-semibold tracking-tight text-neutral-100">
          repo.triage
        </h1>
        <div className="flex flex-wrap items-center gap-3 [&_button]:whitespace-nowrap">
          <button
            onClick={() => setStatusOpen(true)}
            className={cx(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-neutral-800",
              data.sourceWarnings?.length > 0 || data.rateLimit?.remaining === 0
                ? "border-amber-500/60 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                : "border-neutral-700 bg-neutral-900 text-neutral-200",
            )}
            aria-label="Open dashboard status"
          >
            <InfoIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Status
          </button>
          <button
            onClick={openSettings}
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
            aria-label="Open settings"
          >
            <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Settings
          </button>
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
            disabled={
              refreshing ||
              data.syncing ||
              data.rateLimit?.authInvalid ||
              data.rateLimit?.remaining === 0
            }
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            <SyncIcon
              className={cx(
                "h-3.5 w-3.5",
                (refreshing || data.syncing) && "animate-spin",
              )}
              aria-hidden="true"
            />
            {refreshing || data.syncing ? "syncing..." : "sync GitHub"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-900 px-5 py-2">
        <label className="relative block">
          <SearchIcon
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter repos..."
            aria-label="Search repositories"
            className="w-64 rounded-md border border-neutral-800 bg-neutral-950 pl-7 pr-3 py-1.5 text-xs text-neutral-100 outline-hidden focus:border-neutral-600"
          />
        </label>
        {isMobile ? (
          <button
            onClick={() => setActionsOpen(true)}
            aria-label="More filters and options"
            aria-haspopup="dialog"
            className="ml-auto flex min-h-11 items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            <MoreIcon className="h-4 w-4" aria-hidden="true" />
            filters
          </button>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1 border-l border-neutral-800 pl-3 [&_button]:whitespace-nowrap [&_label]:whitespace-nowrap">
              {filterPills}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-l border-neutral-800 pl-3 [&_button]:whitespace-nowrap [&_label]:whitespace-nowrap">
              {optionControls}
            </div>
          </>
        )}
      </div>

      {isMobile && actionsOpen && (
        <MobileActionSheet
          title="Filters & options"
          onClose={() => setActionsOpen(false)}
        >
          {/* Bump relocated controls to the ≥44px mobile touch target (DESIGN.md
              → Touch targets) without altering the shared desktop fragments. */}
          <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-11 [&_label]:min-h-11 [&_select]:min-h-11 [&_button]:whitespace-nowrap [&_label]:whitespace-nowrap">
            {filterPills}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3 [&_button]:min-h-11 [&_label]:min-h-11 [&_select]:min-h-11 [&_button]:whitespace-nowrap [&_label]:whitespace-nowrap">
            {optionControls}
          </div>
        </MobileActionSheet>
      )}

      <main className="flex flex-1 flex-col overflow-hidden p-5">
        {data.rateLimit?.authInvalid && (
          <div className="mb-4 rounded-lg border border-rose-500/60 bg-rose-500/15 px-4 py-3 text-xs text-rose-200">
            <strong>GitHub token is invalid or expired.</strong> Update
            GITHUB_TOKEN in your .env file and restart the server.
          </div>
        )}
        {data.rateLimit?.remaining === 0 && !data.rateLimit?.authInvalid && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            GitHub API rate limit exhausted. Resets at{" "}
            {data.rateLimit.reset
              ? new Date(data.rateLimit.reset * 1000).toLocaleTimeString()
              : "unknown"}
            . Manual sync is disabled until the limit resets.
          </div>
        )}
        {data.lastError &&
          !data.rateLimit?.authInvalid &&
          data.rateLimit?.remaining !== 0 && (
            <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              GitHub error: {data.lastError}
              {!data.tokenPresent &&
                " — no token found. Set GITHUB_TOKEN in .env, or run `gh auth login`."}
            </div>
          )}
        {showingCachedData && (
          <div className="mb-4 rounded-lg border border-neutral-700 bg-neutral-900/70 px-4 py-3 text-xs text-neutral-300">
            Showing cached board while refreshing from GitHub.
          </div>
        )}
        {selectedIds.size > 0 && (
          <BulkBar
            count={selectedIds.size}
            actions={bulkActions}
            columns={dayColumns}
            onClear={clearSelection}
          />
        )}
        {loading || (!data.cacheReady && !showingCachedData) ? (
          <div className="grid h-40 place-items-center text-center text-sm text-neutral-600">
            <div>
              <div>
                {loading
                  ? "loading..."
                  : "fetching repositories from GitHub..."}
              </div>
              {!loading && !data.cacheReady && (
                <div className="mt-1 text-xs text-neutral-700">
                  the server is still talking to the GitHub API
                </div>
              )}
            </div>
          </div>
        ) : view === "list" ? (
          <ListView repos={filtered} {...cardProps} />
        ) : isMobile ? (
          <div
            role="group"
            aria-label="Repository board"
            aria-busy={data.syncing || undefined}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <MobileBoard
              columns={mobileColumns}
              onDropColumn={onDropColumn}
              {...cardProps}
            />
          </div>
        ) : (
          <div
            role="group"
            aria-label="Repository board"
            aria-busy={data.syncing || undefined}
            className="flex min-h-0 flex-1 gap-4 overflow-hidden"
          >
            {groupBy === "day" ? (
              <>
                <div className="sticky left-0 z-10 flex gap-4 bg-neutral-950/95 pr-2 backdrop-blur-xs">
                  {uncheckedRepos.length > 0 && (
                    <Column
                      col={uncheckedColumn}
                      repos={uncheckedRepos}
                      onDropColumn={onDropColumn}
                      schedulable={false}
                      {...cardProps}
                    />
                  )}
                  {todayColumn && (
                    <Column
                      col={todayColumn}
                      repos={groups[todayColumn.key] || []}
                      onDropColumn={onDropColumn}
                      {...cardProps}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-2">
                  <div className="flex h-full min-w-max gap-4 pr-4">
                    {futureColumns.map((col) => (
                      <Column
                        key={col.key}
                        col={col}
                        repos={groups[col.key] || []}
                        onDropColumn={onDropColumn}
                        {...cardProps}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden pb-2">
                <div className="flex h-full min-w-max gap-4 pr-4">
                  {groupedColumns.length === 0 ? (
                    <div className="grid flex-1 place-items-center text-center text-xs text-neutral-700">
                      no repositories to group
                    </div>
                  ) : (
                    groupedColumns.map((col) => (
                      <Column
                        key={col.key}
                        col={col}
                        repos={col.repos}
                        schedulable={false}
                        onDropColumn={() => {
                          /* no-op */
                        }}
                        {...cardProps}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {settingsOpen && (
        <SettingsDialog
          settings={remoteSettings?.settings}
          defaults={remoteSettings?.defaults}
          tagRules={tagRules}
          lastExport={lastExport}
          onSave={saveSettings}
          onTagRuleSave={(tag, days) =>
            api
              .putTagRule(tag, days)
              .then(() => api.getTagRules())
              .then((d) => {
                setTagRules(d.rules ?? []);
                load();
              })
          }
          onTagRuleDelete={(tag) =>
            api
              .deleteTagRule(tag)
              .then(() => api.getTagRules())
              .then((d) => {
                setTagRules(d.rules ?? []);
                load();
              })
          }
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {statusOpen && (
        <StatusDialog data={data} onClose={() => setStatusOpen(false)} />
      )}
      {reportsOpen && <ReportsDialog onClose={() => setReportsOpen(false)} />}
      {noticesScope != null && (
        <NoticesDialog
          scope={noticesScope}
          repos={data.repos}
          onClose={() => setNoticesScope(null)}
          onScopeChange={setNoticesScope}
          onChanged={load}
          onDeleted={(notice) =>
            notice &&
            showToast("Notice deleted", () =>
              mutate(() =>
                api.addNotice(notice.repo_id, notice.body, notice.created_at),
              ),
            )
          }
        />
      )}
      {issuesRepo && (
        <IssuesDialog repo={issuesRepo} onClose={() => setIssuesRepoId(null)} />
      )}
      {issuesOverviewOpen && (
        <IssuesOverviewDialog onClose={() => setIssuesOverviewOpen(false)} />
      )}
      {eventLogOpen && <EventLogView onClose={() => setEventLogOpen(false)} />}
      {toast && (
        <Toast
          message={toast.message}
          onUndo={
            toast.undo
              ? () => {
                  // Grab and clear the ref before async work starts to prevent the
                  // auto-dismiss timer from also calling discardUndo concurrently.
                  const undoId = pendingUndoIdRef.current;
                  pendingUndoIdRef.current = null;
                  toast.undo();
                  // In-session toasts: undo is a closure; discard the persisted entry.
                  // Startup-recovery toasts: undo calls executeUndo which already deletes.
                  if (undoId && !toast.undoHandlesCleanup) {
                    api.discardUndo?.(undoId).catch(() => {
                      /* no-op */
                    });
                  }
                  setToast(null);
                }
              : undefined
          }
          onDismiss={() => {
            const undoId = pendingUndoIdRef.current;
            pendingUndoIdRef.current = null;
            if (undoId)
              api.discardUndo?.(undoId).catch(() => {
                /* no-op */
              });
            setToast(null);
          }}
        />
      )}
      {import.meta.env.DEV && <DevIdOverlay />}
    </div>
  );
}
