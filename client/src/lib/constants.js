import { ArrowDownUp, Archive, BarChart3, CalendarDays, CircleDot, CircleHelp, EyeOff, GitFork, LayoutGrid, List, MoreHorizontal, RefreshCw, Rows2, Search, Settings2, Star, StickyNote, Tag, User } from 'lucide-react';

// Tiny className joiner used throughout the UI.
export const cx = (...a) => a.filter(Boolean).join(' ');

// Per-column accent tones for the day-schedule board.
export const ACCENT = {
  neutral: { dot: 'bg-neutral-500', head: 'text-neutral-300', edge: 'border-neutral-800' },
  rose: { dot: 'bg-rose-500', head: 'text-rose-300', edge: 'border-rose-500/30' },
  amber: { dot: 'bg-amber-500', head: 'text-amber-300', edge: 'border-amber-500/30' },
  sky: { dot: 'bg-sky-500', head: 'text-sky-300', edge: 'border-sky-500/30' },
};

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

// Triage priority is an independent axis from scheduling. P1/P2/P3 map to a
// fixed tone (warm = more urgent); null means unprioritised. The state colours
// here are deliberate semantic accents, not the categorical owner/tag palette.
export const PRIORITY_LEVELS = [1, 2, 3];
export const PRIORITY_META = {
  1: { label: 'P1', title: 'Priority 1 (high)', dot: '#f87171', chip: 'bg-rose-500/15 text-rose-200' },
  2: { label: 'P2', title: 'Priority 2 (medium)', dot: '#fbbf24', chip: 'bg-amber-500/15 text-amber-200' },
  3: { label: 'P3', title: 'Priority 3 (low)', dot: '#60a5fa', chip: 'bg-sky-500/15 text-sky-200' },
};

// The four priority filter options: P1/P2/P3 plus "no priority" (level 0).
export const PRIORITY_FILTER_OPTIONS = [
  ...PRIORITY_LEVELS.map((level) => ({ level, ...PRIORITY_META[level] })),
  { level: 0, label: 'None', title: 'No priority', dot: '#52525b' },
];

export const ICON = {
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
  density: Rows2,
  sort: ArrowDownUp,
  calendar: CalendarDays,
  more: MoreHorizontal,
  list: List,
  board: LayoutGrid,
};

// Labels for the within-column sort selector (keys come from board.js SORT_KEYS).
export const SORT_LABELS = {
  manual: 'Manual order',
  name: 'Name',
  pushed: 'Recently pushed',
  stars: 'Stars',
  due: 'Due soonest',
};

// Labels for the board group-by selector (keys come from board.js GROUP_BY_KEYS).
export const GROUP_BY_LABELS = {
  day: 'Day schedule',
  owner: 'Owner',
  tag: 'Tag',
  language: 'Language',
};

// Toggleable card fields (all shown by default).
export const FIELD_OPTIONS = [
  { key: 'language', label: 'Language' },
  { key: 'pushed', label: 'Pushed date' },
  { key: 'stars', label: 'Stars' },
  { key: 'issues', label: 'Open issues' },
  { key: 'forks', label: 'Forks' },
  { key: 'notice', label: 'Notice preview' },
];
export const DEFAULT_FIELDS = Object.fromEntries(FIELD_OPTIONS.map((f) => [f.key, true]));

export const REPORT_LABELS = {
  summary: 'summary',
  due: 'due today',
  'never-reviewed': 'never reviewed',
  stale: 'stale',
  owners: 'owners',
  languages: 'languages',
  archived: 'archived',
  active: 'open issues',
};
