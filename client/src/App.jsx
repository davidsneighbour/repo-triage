import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, BarChart3, CircleDot, CircleHelp, EyeOff, GitFork, RefreshCw, Search, Settings2, Star, StickyNote, Tag, Trash2, User, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from './api.js';
import { timeAgo, calendarLabel } from './lib/date.js';
import { defaultFilters, filterRepos, repoMatchesQuery, buildDayColumns, groupRepos, sortNotices, collectTags } from './lib/board.js';
import helpMarkdown from './help.md?raw';
import helpDiagramSvg from './help-diagram.svg?raw';

const ACCENT = {
  neutral: { dot: 'bg-neutral-500', head: 'text-neutral-300', edge: 'border-neutral-800' },
  rose: { dot: 'bg-rose-500', head: 'text-rose-300', edge: 'border-rose-500/30' },
  amber: { dot: 'bg-amber-500', head: 'text-amber-300', edge: 'border-amber-500/30' },
  sky: { dot: 'bg-sky-500', head: 'text-sky-300', edge: 'border-sky-500/30' },
};

const cx = (...a) => a.filter(Boolean).join(' ');
const BOARD_CACHE_KEY = 'repo-triage-board-cache-v1';

// Categorical owner-identity palette (see DESIGN.md → Colors → Owner palette).
// Muted hues kept clear of the semantic ramps (rose/amber/sky/emerald/violet).
// Applied via inline style because the owner set is dynamic/unbounded.
const OWNER_PALETTE = ['#2dd4bf', '#818cf8', '#e879f9', '#fb923c', '#a3e635', '#22d3ee', '#f472b6', '#5eead4'];

export function ownerColor(login) {
  const s = String(login || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return OWNER_PALETTE[h % OWNER_PALETTE.length];
}

// Tag chips reuse the same categorical palette, hashed differently so a tag and
// a same-named owner don't land on the same colour (they're told apart by the
// `#` prefix + owner stripe, but distinct hues reduce accidental association).
export function tagColor(tag) {
  const s = String(tag || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return OWNER_PALETTE[h % OWNER_PALETTE.length];
}

const EMPTY_DATA = {
  repos: [],
  cacheReady: false,
  syncing: false,
  defaultInactivityDays: 7,
  lastFetch: null,
  username: null,
  owners: [],
  sourceWarnings: [],
  tokenPresent: true,
  authSource: null,
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
  ignored: EyeOff,
  notices: StickyNote,
  star: Star,
  issues: CircleDot,
  tag: Tag,
  reports: BarChart3,
};

const REPORT_LABELS = {
  summary: 'summary',
  due: 'due today',
  'never-reviewed': 'never reviewed',
  stale: 'stale',
  owners: 'owners',
  languages: 'languages',
  archived: 'archived',
  active: 'open issues',
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
  return <span className={cx('rounded-sm px-1.5 py-0.5 text-[10px] font-medium', tones[tone])}>{children}</span>;
}

function CardMenu({ repo, anchorRef, defaultInactivity, allTags = [], onSetChecked, onClearCheck, onSetInactivity, onSetIgnored, onAddNotice, onViewNotices, onAddTag, onRemoveTag, onClose }) {
  const [days, setDays] = useState(repo.inactivity_days ?? '');
  const [notice, setNotice] = useState('');
  const [tag, setTag] = useState('');
  const [pos, setPos] = useState(null);

  const submitTag = () => {
    const v = tag.trim();
    if (v) {
      onAddTag(repo.id, v);
      setTag('');
    }
  };

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
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-hidden focus:border-neutral-500"
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

        <div className="mt-2 border-t border-neutral-800 pt-2">
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Tags</label>
          {repo.tags?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {repo.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(t) }} aria-hidden="true" />
                  #{t}
                  <button onClick={() => onRemoveTag(repo.id, t)} aria-label={`Remove tag ${t}`} className="text-neutral-500 hover:text-rose-300">
                    <X className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 flex items-center gap-1">
            <input
              list="card-tag-suggestions"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitTag();
                }
              }}
              placeholder="add tag..."
              aria-label="New tag"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-hidden focus:border-neutral-500"
            />
            <button
              disabled={tag.trim() === ''}
              onClick={submitTag}
              aria-label="Add tag"
              className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {allTags.length > 0 && (
            <datalist id="card-tag-suggestions">
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          )}
        </div>

        <div className="mt-2 border-t border-neutral-800 pt-2">
          <button
            onClick={() => {
              onSetIgnored(repo.id, !repo.ignored);
              onClose();
            }}
            className="w-full rounded-md bg-neutral-800 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
          >
            {repo.ignored ? 'Unignore repo' : 'Ignore repo'}
          </button>
        </div>

        <div className="mt-2 border-t border-neutral-800 pt-2">
          <label className="block px-1 text-[10px] uppercase tracking-widest text-neutral-500">Notice</label>
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={2}
            placeholder="add a note..."
            aria-label="New notice"
            className="mt-1 w-full resize-none rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-hidden focus:border-neutral-500"
          />
          <div className="mt-1 flex items-center gap-1">
            <button
              disabled={notice.trim() === ''}
              onClick={() => {
                onAddNotice(repo.id, notice.trim());
                setNotice('');
                onClose();
              }}
              className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
            >
              Add
            </button>
            <button
              onClick={() => {
                onViewNotices(repo.id);
                onClose();
              }}
              className="rounded-md px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200"
            >
              View all ({repo.notice_count ?? 0})
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function HelpDialog({ onClose }) {
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

                // The flow diagram is pre-rendered to SVG at build time (see
                // scripts/build-help-diagram.mjs) so we never run Mermaid in the
                // browser — that rendering was unreliable and showed a fallback.
                if (match?.[1] === 'mermaid') {
                  return (
                    <figure
                      role="img"
                      aria-label="Repo.triage data-loading flow diagram"
                      className="mb-3 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 [&>svg]:h-auto [&>svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: helpDiagramSvg }}
                    />
                  );
                }

                return (
                  <code className="rounded-sm bg-neutral-950 px-1 py-0.5 text-[11px] text-neutral-200">
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

function NoticesDialog({ scope, repos, onClose, onScopeChange, onChanged }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('date');
  const [dir, setDir] = useState('desc');

  const isAll = scope === 'all';
  const repo = isAll ? null : repos.find((r) => r.id === scope);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = isAll ? await api.allNotices() : await api.repoNotices(scope);
      setNotices(res.notices || []);
    } finally {
      setLoading(false);
    }
  }, [isAll, scope]);

  useEffect(() => {
    reload();
  }, [reload]);

  const sorted = useMemo(() => sortNotices(notices, sort, dir), [notices, sort, dir]);

  const removeNotice = async (noticeId) => {
    await api.deleteNotice(noticeId);
    await reload();
    onChanged?.();
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section className="fixed inset-x-4 top-6 z-40 mx-auto flex max-h-[88vh] max-w-3xl flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100">Notices</h2>
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
                    <button onClick={() => removeNotice(n.id)} aria-label="Delete notice" className="text-neutral-600 hover:text-rose-300">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
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

function RepoCard({ repo, column, menuOpenId, showOwner, onToggleMenu, onDragStartCard, onDropOnCard, ...handlers }) {
  const SettingsIcon = ICON.settings;
  const StarIcon = ICON.star;
  const IssueIcon = ICON.issues;
  const menuButtonRef = useRef(null);
  const ownerTint = showOwner && repo.owner ? ownerColor(repo.owner) : null;

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
      style={ownerTint ? { borderLeftColor: ownerTint, borderLeftWidth: 3 } : undefined}
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
        {ownerTint && (
          <span
            className="inline-flex items-center gap-1 rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300"
            title={`owner: ${repo.owner}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ownerTint }} aria-hidden="true" />
            {repo.owner}
          </span>
        )}
        <Badge tone={repo.private ? 'amber' : 'emerald'}>{repo.private ? 'private' : 'public'}</Badge>
        {repo.archived ? <Badge tone="neutral">archived</Badge> : <Badge tone="sky">live</Badge>}
        {repo.fork && <Badge tone="neutral">fork</Badge>}
        {repo.language && <Badge tone="violet">{repo.language}</Badge>}
        {repo.ignored && <Badge tone="neutral">ignored</Badge>}
      </div>

      {repo.tags?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {repo.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(tag) }} aria-hidden="true" />
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">pushed {timeAgo(repo.pushed_at)}</span>
          {repo.stargazers_count > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 tabular-nums" title={`${repo.stargazers_count} stargazers`}>
              <StarIcon className="h-3 w-3" aria-hidden="true" />
              {repo.stargazers_count}
            </span>
          )}
          {repo.open_issues_count > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 tabular-nums" title={`${repo.open_issues_count} open issues / PRs`}>
              <IssueIcon className="h-3 w-3" aria-hidden="true" />
              {repo.open_issues_count}
            </span>
          )}
        </span>
        <span className="shrink-0">
          {repo.checkedAgeDays == null
            ? 'not checked yet'
            : repo.checkedAgeDays === 0
            ? 'checked today'
            : `checked ${repo.checkedAgeDays}d ago`}
        </span>
      </div>

      <div className="mt-1 text-[11px] text-neutral-500">
        {repo.needsCheckToday ? (
          <span className="text-rose-300">review today</span>
        ) : (
          <span>review in {repo.dueInDays}d</span>
        )}
      </div>

      {repo.latest_notice && (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-md bg-neutral-950 px-2 py-1.5">
          <p className="line-clamp-2 text-[11px] text-neutral-300">{repo.latest_notice.body}</p>
          <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">{timeAgo(repo.latest_notice.created_at)}</span>
        </div>
      )}

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
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 pl-7 pr-7 py-1 text-[11px] text-neutral-100 outline-hidden focus:border-neutral-600"
        />
        {cq && (
          <button
            type="button"
            onClick={() => setCq('')}
            aria-label={`Clear ${col.title} filter`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-neutral-600 hover:text-neutral-200"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
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

function ReportsDialog({ onClose }) {
  const [kinds, setKinds] = useState(['summary']);
  const [kind, setKind] = useState('summary');
  const [view, setView] = useState('table');
  const [report, setReport] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .reportKinds()
      .then((d) => {
        if (d?.kinds?.length) setKinds(d.kinds);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCopied(false);
    const days = kind === 'stale' ? 180 : undefined;
    const done = (fn) => (val) => {
      if (cancelled) return;
      fn(val);
      setLoading(false);
    };
    if (view === 'table') {
      api.report(kind, { days }).then(done(setReport)).catch(done(() => setReport(null)));
    } else {
      api.report(kind, { format: view === 'markdown' ? 'md' : 'csv', days }).then(done(setText)).catch(done(() => setText('')));
    }
    return () => {
      cancelled = true;
    };
  }, [kind, view]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section className="fixed inset-x-4 top-6 z-40 mx-auto flex max-h-[88vh] max-w-3xl flex-col overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100">Reports</h2>
            <p className="text-[11px] text-neutral-500">{report?.title || REPORT_LABELS[kind] || kind}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-neutral-700 text-[11px]">
              {['table', 'markdown', 'csv'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cx('px-2 py-1', view === v ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
                >
                  {v}
                </button>
              ))}
            </div>
            <button onClick={onClose} aria-label="Close reports" className="rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-1 border-b border-neutral-800 px-4 py-2">
          {kinds.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cx(
                'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                kind === k ? 'border-neutral-600 bg-neutral-800 text-neutral-200' : 'border-neutral-800 text-neutral-500 hover:bg-neutral-800'
              )}
            >
              {REPORT_LABELS[k] || k}
            </button>
          ))}
        </div>

        <div className="overflow-auto px-4 py-3">
          {loading ? (
            <p className="py-6 text-center text-xs text-neutral-600">loading...</p>
          ) : view === 'table' ? (
            !report || report.rows.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-700">no matching repositories</p>
            ) : (
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr>
                    {report.columns.map((c) => (
                      <th key={c} className="border-b border-neutral-800 px-2 py-1 font-medium text-neutral-400">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-900/60">
                      {row.map((cell, j) => (
                        <td key={j} className="border-b border-neutral-800/60 px-2 py-1 tabular-nums text-neutral-300">{String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div>
              <div className="mb-1 flex justify-end">
                <button onClick={copy} className="rounded-md border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:bg-neutral-800">
                  {copied ? 'copied' : 'copy'}
                </button>
              </div>
              <pre className="overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 text-[11px] text-neutral-300">{text}</pre>
            </div>
          )}
        </div>
      </section>
    </>,
    document.body
  );
}

function TagFilter({ available, value, onChange }) {
  const TagIcon = ICON.tag;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const selected = value.tags;

  useEffect(() => {
    if (!open) return undefined;
    const el = btnRef.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      const width = 224;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  const toggleTag = (tag) =>
    onChange({ ...value, tags: selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag] });

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Filter by tag"
        aria-expanded={open}
        className={cx(
          'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
          selected.length ? 'border-neutral-600 bg-neutral-800 text-neutral-200' : 'border-neutral-800 bg-transparent text-neutral-600'
        )}
      >
        <TagIcon className="h-3 w-3" aria-hidden="true" />
        tags{selected.length ? ` (${selected.length})` : ''}
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div
              className="fixed z-20 w-56 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-2xl"
              style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
            >
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500">Filter by tag</span>
                {selected.length > 0 && (
                  <button onClick={() => onChange({ tags: [], mode: value.mode })} className="text-[10px] text-neutral-400 hover:text-neutral-200">
                    clear
                  </button>
                )}
              </div>
              {selected.length >= 2 && (
                <div className="mb-1 flex overflow-hidden rounded-md border border-neutral-700 text-[10px]">
                  {['any', 'all'].map((m) => (
                    <button
                      key={m}
                      onClick={() => onChange({ ...value, mode: m })}
                      className={cx('flex-1 px-2 py-0.5', value.mode === m ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800')}
                    >
                      match {m}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-56 overflow-auto">
                {available.length === 0 ? (
                  <p className="px-1 py-2 text-center text-[11px] text-neutral-600">no tags yet</p>
                ) : (
                  available.map(({ tag, count }) => (
                    <label key={tag} className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800">
                      <input type="checkbox" checked={selected.includes(tag)} onChange={() => toggleTag(tag)} className="accent-neutral-500" />
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(tag) }} aria-hidden="true" />
                      <span className="flex-1 truncate">#{tag}</span>
                      <span className="tabular-nums text-neutral-600">{count}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export default function App() {
  const SyncIcon = ICON.sync;
  const SearchIcon = ICON.search;
  const HelpIcon = ICON.help;
  const IgnoredIcon = ICON.ignored;
  const NoticesIcon = ICON.notices;
  const ReportsIcon = ICON.reports;

  const [data, setData] = useState(() => readBoardCache() ?? EMPTY_DATA);
  const [loading, setLoading] = useState(() => !readBoardCache());
  const [showingCachedData, setShowingCachedData] = useState(() => Boolean(readBoardCache()));
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Notices dialog scope: null (closed) | 'all' | a repo id.
  const [noticesScope, setNoticesScope] = useState(null);
  // Transient tag query: which tags to match and whether any/all.
  const [tagFilter, setTagFilter] = useState({ tags: [], mode: 'any' });
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
  const onClearCheck = (id) => mutate(() => api.setPriority(id, null));
  const onSetInactivity = (id, days) => mutate(() => api.setInactivity(id, days));
  const onSetIgnored = (id, ignored) => mutate(() => api.setIgnored(id, ignored));
  const onAddNotice = (id, body) => mutate(() => api.addNotice(id, body));
  const onViewNotices = (scope) => setNoticesScope(scope);
  const onAddTag = (id, tag) => mutate(() => api.addTag(id, tag));
  const onRemoveTag = (id, tag) => mutate(() => api.removeTag(id, tag));
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
    return filterRepos(data.repos, q, filters, showIgnored, tagFilter);
  }, [data.repos, q, filters, showIgnored, tagFilter]);

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
    return groupRepos(filtered, dayColumns);
  }, [filtered, dayColumns]);

  const ownerLabel = data.owners?.length
    ? data.owners.length <= 3
      ? data.owners.map((o) => `@${o}`).join(', ')
      : `${data.owners.length} owners`
    : data.username
    ? `@${data.username}`
    : 'authenticated user';

  const todayColumn = dayColumns[0];
  const futureColumns = dayColumns.slice(1);

  const cardProps = {
    menuOpenId: openMenuId,
    showOwner: showOwners,
    onToggleMenu,
    onDragStartCard,
    onDropOnCard,
    onSetChecked,
    onClearCheck,
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
        ) : (
          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
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
