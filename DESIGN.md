---
version: alpha
name: repo.triage
description: >
  A local-only day-schedule kanban dashboard for GitHub repositories.
  Dark, monospaced, high-contrast. Information density over decoration.
colors:
  # Surfaces — the neutral ramp carries a faint phosphor-green tint (old CRT
  # terminal). Subtle on purpose; accent ramps below stay pure.
  background: "#080c08"
  surface: "#141a15"
  surface-subtle: "#0b110c"
  # Borders
  border: "#1f2a21"
  border-muted: "#38463b"
  # Text
  text-primary: "#eff5f0"
  text-secondary: "#cbd8cd"
  text-muted: "#748a78"
  text-faint: "#5d7061"
  # Accent — Today / urgent
  accent-today: "#f43f5e"
  accent-today-dim: "#fda4af"
  accent-today-bg: "#1e0a0f"
  # Accent — Near-term (tomorrow / day-after)
  accent-near: "#f59e0b"
  accent-near-dim: "#fcd34d"
  accent-near-bg: "#1c1100"
  # Accent — Future columns
  accent-future: "#0ea5e9"
  accent-future-dim: "#7dd3fc"
  accent-future-bg: "#021018"
  # Semantic
  danger: "#f43f5e"
  danger-bg: "#1e0a0f"
  warning: "#f59e0b"
  warning-bg: "#1c1100"
  # Brand/logo asset colours
  brand-logo-bg: "#003f5c"
  brand-logo-line: "#ffa600"
brand:
  logo:
    source: client/public/logo.svg
    favicon: client/public/favicon.svg
    description: >
      Orange line-art bandage on a dark blue square background, rotated 20
      degrees clockwise. Use as the app identity mark and source for future logo
      variants.
typography:
  body:
    fontFamily: IBM Plex Mono
    fontSize: 0.875rem
    lineHeight: 1.5
  body-sm:
    fontFamily: IBM Plex Mono
    fontSize: 0.75rem
    lineHeight: 1.5
  label:
    fontFamily: IBM Plex Mono
    fontSize: 0.6875rem
    lineHeight: 1.4
  micro:
    fontFamily: IBM Plex Mono
    fontSize: 0.625rem
    lineHeight: 1.4
    letterSpacing: 0.08em
  heading:
    fontFamily: IBM Plex Mono
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.25
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  board-col-width: 288px
  board-col-gap: 16px
components:
  # ---- Column header -------------------------------------------------------
  column-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: 8px 12px
  column-header-today:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-today-dim}"
  column-header-near:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-near-dim}"
  column-header-future:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-future-dim}"
  # ---- Repo card -----------------------------------------------------------
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 12px
  card-hover:
    backgroundColor: "{colors.surface}"
  # ---- Card notice (latest notice preview, read-only) ----------------------
  card-notice:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: 6px 8px
  # ---- Badge ---------------------------------------------------------------
  badge:
    rounded: "{rounded.sm}"
    padding: 2px 6px
  badge-private:
    backgroundColor: "{colors.accent-near-bg}"
    textColor: "{colors.accent-near-dim}"
  badge-public:
    backgroundColor: "#052e16"
    textColor: "#6ee7b7"
  badge-archived:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
  badge-live:
    backgroundColor: "{colors.accent-future-bg}"
    textColor: "{colors.accent-future-dim}"
  badge-fork:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
  badge-language:
    backgroundColor: "#1a0a2e"
    textColor: "#c4b5fd"
  badge-ignored:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
  # ---- Repo owner indicator -----------------------------------------------
  # Identity, not urgency. The dot/stripe colour comes from the categorical
  # owner palette (see Colors → Owner palette) and is applied via inline style
  # because the owner set is dynamic; the pill itself stays neutral.
  badge-owner:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
  card-owner-stripe:
    # 3px left edge on the card, coloured from the owner palette.
    width: 3px
  # ---- Tag chip ------------------------------------------------------------
  # Neutral pill with a leading dot coloured from the categorical palette
  # (inline style); text is the `#tag`. Same identity rationale as the owner
  # badge — categorical, never an urgency signal.
  badge-tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
  # ---- Buttons -------------------------------------------------------------
  button-primary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  button-primary-hover:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-faint}"
  button-danger:
    backgroundColor: "{colors.accent-today-bg}"
    textColor: "{colors.accent-today-dim}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  button-danger-hover:
    backgroundColor: "#2d1018"
    textColor: "{colors.accent-today-dim}"
  # ---- Filter pill ---------------------------------------------------------
  filter-pill-active:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: 4px 8px
  filter-pill-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.text-faint}"
    rounded: "{rounded.md}"
    padding: 4px 8px
  # ---- Text input ----------------------------------------------------------
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  input-focus:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
  # ---- Popover / card menu -------------------------------------------------
  popover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: 8px
  # ---- Help affordances ---------------------------------------------------
  help-trigger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: 6px 10px
  help-dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: 16px
  # Surface that holds the help flow diagram. The diagram is pre-rendered to a
  # static SVG at build time (src/help-diagram.svg via scripts/build-help-diagram.mjs)
  # and inlined — Mermaid is not run in the browser. The SVG uses the neutral
  # ramp only: surface nodes, border-muted/text-faint strokes, text-secondary
  # labels. No accent colours.
  help-mermaid-surface:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: 12px
  # ---- Notices dialog ------------------------------------------------------
  notices-dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: 16px
  notices-row:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  # ---- Banner — auth error -------------------------------------------------
  banner-error:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.accent-today-dim}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  # ---- Banner — rate limit warning -----------------------------------------
  banner-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.accent-near-dim}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  # ---- Rate-limit indicator ------------------------------------------------
  rate-limit-ok:
    textColor: "{colors.text-faint}"
  rate-limit-low:
    textColor: "{colors.accent-near}"
  rate-limit-zero:
    textColor: "{colors.accent-today}"
---
<!-- markdownlint-disable list-duplicates MD041 -->

## Overview

**Aesthetic:** Terminal minimalism. The board feels like a well-structured CLI
output rendered as a web app — not a decorative SaaS product. Monospaced
throughout. Dark, near-black surfaces. High-contrast text. Accent colours carry
semantic meaning only; they are never decorative.

**Guiding principles:**

1. **Information density over whitespace.** Every pixel should serve data or
   structure, not brand identity.
2. **Colour = signal.** Each accent colour encodes a specific urgency state.
   Do not introduce new accent colours for aesthetic reasons. The sole
   non-signal colour is the faint phosphor-green tint baked into the neutral
   chrome ramp (see Colors) — it is global, low-saturation, and carries no
   meaning; it is not an accent and must never compete with the urgency ramps.
3. **Monospace everywhere.** IBM Plex Mono is the sole typeface. No serif or
   sans-serif mixing. This reinforces the developer-tool character and ensures
   tabular data (counts, timestamps) aligns naturally.
4. **Dark-only.** There is no light mode. The design is calibrated for
   `color-scheme: dark` exclusively.
5. **No broad elevation hierarchy via shadows.** Depth is primarily expressed
  through border contrast and background opacity (`/70`, `/40`).

## Colors

The palette has one dark neutral ramp and three semantic accent colours.

### Neutral ramp (surfaces, text, borders) — phosphor-green tint

The neutral ramp — every chrome element: borders, outlines, icons, buttons,
inputs, dropdowns, popovers, body text — carries a **faint neon-green tint**,
evoking an old phosphor CRT terminal. It is deliberately low-saturation (a
"sprinkle", not a glow): strongest in the mid/dark border tones (~10–15 %
saturation) and barely present at the light text extremes. The semantic accent
ramps (rose / amber / sky) and the status badges (emerald / violet) stay **pure**
— the tint never touches signal colour.

It is implemented once by overriding the Tailwind `--color-neutral-*` tokens in
`client/src/index.css`, so every `*-neutral-*` utility inherits it; do not tint
individual components by hand. Update both this table and those tokens together.

| Token | Hex | Role |
| --- | --- | --- |
| `background` | `#080c08` | Page background (Tailwind neutral-950) |
| `surface` | `#141a15` | Cards, column headers, popovers (neutral-900) |
| `border` | `#1f2a21` | Default borders (neutral-800) |
| `border-muted` | `#38463b` | Hover / focus borders (neutral-700) |
| `text-primary` | `#eff5f0` | Headlines, repo names (neutral-100) |
| `text-secondary` | `#cbd8cd` | Body text, column headers (neutral-300) |
| `text-muted` | `#748a78` | Metadata, timestamps (neutral-500) |
| `text-faint` | `#5d7061` | Placeholder text, empty states (neutral-600) |

`text-muted` clears WCAG AA (≈4.8:1 on `surface`) for small text; `text-faint`
clears ≈3:1 (placeholders / empty states). Keep these two no darker than listed.

The background also carries two very subtle radial gradients — a rose tint from
the bottom-left and a sky tint from the top-right — adding depth without
introducing colour at readable sizes.

### Accent ramp — today (urgent)

`accent-today` (`#f43f5e`, Tailwind rose-500) marks the **Today** column and
anything that is overdue or in an error state (invalid token banner, rate-limit
zero indicator). Its dim variant (`#fda4af`) is used for text on dark
backgrounds; the background variant (`#1e0a0f`) is used for banners.

### Accent ramp — near (amber)

`accent-near` (`#f59e0b`, Tailwind amber-500) marks the **tomorrow** and
**day-after-tomorrow** columns and warning states (rate-limit low, rate-limit
exhausted banner). Never used on surfaces that also carry a rose accent.

### Accent ramp — future (sky)

`accent-future` (`#0ea5e9`, Tailwind sky-500) marks all columns beyond day 2.
Also used for the `live` badge. Represents calm, non-urgent states.

### Implicit accent — language badge (violet)

Violet (`#8b5cf6` / dim `#c4b5fd`) is used exclusively for programming-language
badges. It carries no urgency meaning and must not be used in structural
components.

### Owner palette (categorical identity)

When the board loads repos from more than one owner (see `GITHUB_OWNERS`), each
repo card carries an owner indicator. Its colour is **categorical identity**,
not urgency — it groups cards by owner and intentionally sits outside the
semantic rose/amber/sky system.

* A small, fixed palette of muted hues is hashed deterministically from the
  owner login, so a given owner always gets the same colour.
* It is the main place colour is chosen dynamically, so it is applied via
  inline `style` (hex), not Tailwind classes — this is a deliberate, documented
  exception to the "no dynamic class names" rule, because the owner/tag sets are
  unbounded and cannot be statically enumerated. (The only other inline-hex use
  is the fixed P1/P2/P3 priority dot; see Triage priority. Its chip background is
  a static Tailwind class — only the dot is inline.)
* Reserved semantic hues (rose = today, amber = near, sky = future, emerald =
  public, violet = language) are avoided so identity colour never reads as an
  urgency or status signal.
* The same palette colours **tag** chip dots (see Repo tags). The palette lives
  in `App.jsx` as `OWNER_PALETTE` (hashed by `ownerColor` / `tagColor`); update
  this section if it changes. Owners and tags are told apart by structure, not
  hue: owners get a left card stripe + plain login; tags are `#`-prefixed.

## Typography

A single typeface — **IBM Plex Mono** — loaded from the system or CDN. Fall back
to `ui-monospace, SFMono-Regular, Menlo, monospace`. No other typefaces are used.

| Token | Size | Weight | Use |
| --- | --- | --- | --- |
| `heading` | 1rem / 16px | 600 | App title, section titles |
| `body` | 0.875rem / 14px | 400 | Repo names, descriptions, button labels |
| `body-sm` | 0.75rem / 12px | 400 | Card metadata, badge text, input text |
| `label` | 0.6875rem / 11px | 400 | Timestamps, counts, status indicators |
| `micro` | 0.625rem / 10px | 400 | Uppercase section labels (`tracking: 0.08em`) |

`micro` tokens use `uppercase` and a wide letter-spacing to visually separate
them from body content. Do not apply uppercase to any other token scale.

## Layout

### Board layout

The board is a sticky-column horizontal scroll area:

* **Today column** — sticky on the left, `position: sticky`, `z-index: 10`,
  with a `backdrop-blur` backdrop so scrolled content doesn't bleed through.
* **Future columns** — in a horizontally scrollable flex container to the right
  of Today.
* Column width: `288px` (`w-72`). Fixed. Do not make columns fluid.
* Column gap: `16px` (`gap-4`).
* Board padding: `20px` (`p-5`) on all sides.
* Each column is **full-height** within the board viewport; its card list
  scrolls **vertically** (`overflow-y-auto`) rather than growing the page. The
  board area itself does not scroll vertically — the per-column lists do.

### Column anatomy

```plaintext
┌─────────────────────────────┐
│ ● Title   subtitle   [m/N]  │  ← column header (accent dot, count chip)
└─────────────────────────────┘
┌─────────────────────────────┐
│ ☑ ⌕ filter column...  ↕ ▾  │  ← select-all checkbox | filter input | sort
└─────────────────────────────┘
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ← drop zone (dashed border, scrolls vertically)
│  [card]                     │
│  [card]                   ↕ │  ← overflow-y-auto when cards exceed height
│  drag here                  │  ← empty state ("no matches" when filtered)
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

The count chip shows visible/total (`m/N`) when the column filter is active,
otherwise just the total.

**Per-column sort dropdown** — a `<select>` element to the right of the filter
input. Its icon (`↕`) is always `text-neutral-600`; the select itself is
`text-neutral-500 bg-transparent border-neutral-800` when unset (default order)
and switches to `text-neutral-200 bg-neutral-800 border-neutral-600` when an
active sort is applied. Sort is local column state (not persisted). Available
options:

| Value | Label |
| ----- | ----- |
| *(blank)* | default order (board/drag order) |
| `name:asc` | name ↑ |
| `name:desc` | name ↓ |
| `stars:asc` | stars ↑ |
| `stars:desc` | stars ↓ |
| `owner:asc` | owner ↑ |
| `owner:desc` | owner ↓ |

Within-column sort overrides the drag/position order for the lifetime of the
session (cleared on page reload). The board-wide sort selector in the toolbar
sets the default across all columns independently.

### Card anatomy

```plaintext
┌─────────────────────────────────┐
│ repo-name                   [⋯] │
│ short description (2 lines max) │
│ [public] [live] [JavaScript]    │
│ pushed 3d ago ★12 ◌3  checked 2d│
│ review in 5d                    │
│ ▸ latest notice text   2d ago   │  ← card-notice (only if a notice exists)
└─────────────────────────────────┘
```

* Card padding: `12px` (`p-3`).
* **Selection checkbox** — a small leading checkbox in the header row (before the
  name), used for multi-select bulk actions. When the card is selected the
  border brightens to `border-neutral-400` with a `ring-1 ring-neutral-500`.
* Description: `line-clamp-2`. Never wraps further.
* Badge row: flex-wrap, gap `6px`.
* Metadata row: flex row, space-between, `label` scale. The left cluster is
  `pushed <age>` followed by optional **repo stats** — a star glyph + stargazer
  count, an issue glyph + open-issue/PR count, and a fork glyph + fork count.
  Stats are muted (`text-muted`, `tabular-nums`), each shown only when its count
  is `> 0` (and its field toggle is on), and never carry an
  accent colour — they are reference data, not a signal.
* **Card notice** — when a repo has at least one notice, the most recent one
  renders in a `card-notice` block below the metadata: `surface-subtle`
  background, `rounded.md`, `label` scale, body text `line-clamp-2`, with the
  notice's relative timestamp right-aligned. Read-only — authoring and browsing
  notices happen in the `CardMenu` and the Notices dialog. When a card carries
  notices but the repo is otherwise unremarkable, an `ignored` badge may also
  appear in the badge row (see Badge).

### Header

Full-width sticky bar at the top:

* Left: app name + context string (username, repo count, review cycle)
* Right: rate-limit indicator + last-synced timestamp + sync button

### Toolbar

Full-width bar below header:

* Left: text filter input (fixed `256px` width)
* Middle: filter pills (own / forks / archived) + conditional "show all" button
* Right: a separate group, divided by a `border-l`, holding the **board/list**
  view toggle, the **group-by** selector (Day schedule/Owner/Tag/Language; muted
  and disabled in list view), the **density** toggle, the
  within-column **sort** selector (Manual/Name/Recently pushed/Stars/Due
  soonest), the **fields** menu (toggle language/pushed/stars/issues/notice
  preview on cards), the global **show ignored** toggle, the **tag filter**, the
  **priority filter**, a **Reports** button, and a **Notices** button. These sit
  deliberately apart from the inclusive filter pills: ignoring is an independent
  visibility axis, the tag and priority filters are queries, group-by/sort/
  density are view options, and the Reports/Notices buttons open dialogs.

### Board groupings

The board defaults to the **day schedule** (sticky Today + scrollable future
columns, drag-to-schedule). The group-by selector can instead re-column by
**owner**, **tag**, or **language**. Those are **read-only organiser views**:
columns are derived buckets (ordered by repo count, then title, with a "none"
bucket — "untagged"/"no owner"/"no language" — pinned last), cards are not
draggable, and `[`/`]` scheduling is disabled (`schedulable=false`). Grouping by
tag fans a repo out under each of its tags. The card menu still works in every
view. Within-column sort applies to all groupings.

### List view

The board/list toggle swaps the column layout for a single **sortable table**
(`ListView`) over the same filtered repos — good for bulk scanning and reporting.
Columns: Repo (link), Owner (only when the board mixes owners), Priority,
Language, Tags, Pushed, ★, Issues, Due, Checked, plus a per-row gear. Column
headers are click-to-sort (numeric/recency columns default to descending, the
rest ascending; re-clicking flips direction); the gear opens the same `CardMenu`
as a card. Field-visibility toggles hide their columns too. The group-by
selector has no meaning here, so it is muted and disabled. Empty result →
"no repositories match". The view choice persists in localStorage. List rows
carry the same leading selection checkbox as cards.

### Bulk actions

Selecting one or more repos (the card/row checkbox) reveals the **`BulkBar`** —
a sticky `role="region"` strip at the top of the board labelled "Bulk actions",
with a selected-count pill, a `border-l` divider, and buttons: **Checked now**,
**Move to Today**, **Clear check**, **Ignore**, **Unignore**, an inline **tag
input + Add tag**, and a right-aligned **Deselect**. It uses stronger neutral
contrast than the surrounding toolbar so the transient selection mode is hard to
miss without introducing a new semantic accent colour. Each action applies to
the whole selection by looping the existing single-repo API calls, then clears
the selection and refreshes. Selection is transient (not persisted) and is
pruned automatically when a selected repo disappears after a sync.

### Toast (undo)

A single transient **`Toast`** (`role="status"`, bottom-centre, `z-50`) gives
feedback with an optional **Undo** for reversible destructive actions —
currently **ignore** (single via the CardMenu, and bulk). Undo simply
unignores, so it is exact. The toast auto-dismisses after ~6s and has a manual
close. One toast at a time. (Clear-check and notice-deletion are not offered an
undo yet: faithfully restoring them needs server-side state, so they show no
lossy "undo".)

### Responsive / mobile

The board described above is the **desktop** layout. Below a single breakpoint —
`max-width: 640px` (the Tailwind `sm` boundary) — the app switches to a
**mobile** layout. There is no intermediate tablet tier; one breakpoint, two
layouts. The switch is driven by a `matchMedia` hook (`lib/useIsMobile.js`), and
only **presentation** branches on it — data loading, filtering, grouping,
sorting, mutations, and persisted view prefs are shared with desktop. The mobile
layout is a **layout adaptation only**: it inherits the entire visual language
(dark-only, IBM Plex Mono, the rose/amber/sky urgency accents, owner/tag/priority
palettes, `tabular-nums`, `prefers-reduced-motion`) unchanged. It introduces no
new colours and no new typography.

What changes on mobile:

* **Single-column board.** Instead of the sticky-Today + horizontally scrolling
  fixed-`288px` columns, exactly **one full-width day column** is shown at a
  time. This is the one place column width is responsive (full viewport width
  rather than `288px`) — see the carve-out in Do's and don'ts.
* **Day selection via the day picker.** The visible day (Today, Tomorrow, … or,
  under owner/tag/language grouping, the bucket) is chosen from a dropdown opened
  by a **calendar-icon button** (`DayPicker`). The picker lists every column with
  its title, subtitle, and repo count.
* **Long-press to reschedule.** Pointer drag-and-drop is replaced by a
  **long-press** on a card opening the **move sheet** (`MoveSheet`); the `[`/`]`
  keyboard shortcuts still work with an attached keyboard.
* **Collapsed toolbar.** The dense desktop toolbar collapses to a few inline
  controls (search, sync, day picker) plus an overflow **action sheet** holding
  the rest (view toggle, group-by, sort, density, fields, the inclusive filters,
  show-ignored, tag/priority filters, reports, notices, issues, help).
* **Bottom sheets.** Transient surfaces that are anchored popovers on desktop —
  `CardMenu`, `TagFilter`, `PriorityFilter` — render as full-width **bottom
  sheets** (slide-up) on mobile so their controls are thumb-reachable and never
  clipped. Same actions, same handlers; only the container and position change.
* **Touch targets.** Interactive controls are **≥ 44×44px** on mobile. The
  desktop `text-[11px]` pills are fine for a pointer but too small for a thumb;
  mobile variants pad up to the minimum target. This is the only genuinely new
  *visual* rule the mobile layout adds.

Every desktop feature must remain reachable on mobile through one of the
affordances above — feature parity is a hard requirement, not best-effort.

## Elevation & depth

Depth is communicated primarily through:

1. **Border opacity** — `border-neutral-800` (default) vs `border-neutral-700`
   (hover). The difference is subtle but sufficient.
2. **Background opacity** — Cards use `bg-neutral-900/70` against the
   `#0a0a0a` page, creating a slight see-through layering effect.
3. **Backdrop blur** — Applied only to the sticky Today column wrapper
   (`backdrop-blur-xs`) to cleanly separate it from scrolled content.
4. **Z-index layers:**
   * Popovers / card menus: `z-20`
   * Popover backdrop scrim: `z-10`
   * Sticky Today column: `z-10`
5. **Popover emphasis exception:** Card settings popovers use one strong shadow
  (`shadow-2xl`) to clearly separate transient controls from card content.

## Shapes

| Token | Value | Used on |
| --- | --- | --- |
| `rounded.sm` | 4px | Badges |
| `rounded.md` | 6px | Buttons, inputs, filter pills, number chips |
| `rounded.lg` | 8px | Cards, column headers, popovers, banners |
| `rounded.full` | 9999px | Repo-count chips in column header, scrollbar thumbs |

Do not mix border-radius scales on the same component. Do not use
`rounded.none` except for flush-edge internal elements.

## Components

### Column header

Rendered as a flex row inside a `rounded.lg` container. Contains:

* **Accent dot** — `8px` filled circle in the column's accent colour.
* **Title** — `body` scale, `font-semibold`, accent `head` colour.
* **Subtitle** — `label` scale, `text-faint`. Describes the day offset in plain
  language ("needs review", "tomorrow", "day after tomorrow", "in N days").
* **Count chip** — `rounded.full`, `bg-neutral-800`, `label` scale. Shows the
  number of repos in the column.

Column colour assignment (Today column is always column index 0):

| Index | Accent ramp | Example |
| --- | --- | --- |
| 0 | `accent-today` | Today |
| 1–2 | `accent-near` | Tomorrow, day-after-tomorrow |
| 3+ | `accent-future` | Wednesday … |

### Repo card

Draggable. On drag: `cursor-grab` → `cursor-grabbing`. On hover: `border-muted`
replaces default `border`. The `···` settings button is **always visible** —
hiding it on hover was rejected because it creates a discoverability problem for
keyboard-only and touch users, and the dashboard's density-over-decoration
principle makes persistent affordances preferable to hover-reveal patterns.

Keyboard alternative to drag (`aria-keyshortcuts="[ ]"`): with focus anywhere on
a card, `]` pushes it one column further out and `[` pulls it one column toward
Today — the same target math as a drag. The card is labelled as a `group` for
screen readers (repo name, owner, due state).

**Density.** A global toggle (toolbar) switches all cards between two modes,
persisted in localStorage:

* **comfortable** (default) — `p-3`, description `line-clamp-2`, latest-notice
  preview shown.
* **compact** — `p-2`, description `line-clamp-1`, notice preview hidden (still
  reachable in the card menu / Notices dialog). Same data hierarchy, less height.

Only spacing and the optional preview change; badges, owner, stats, and the
review line are always present so the card never loses triage-critical info.

### Badge

Read-only labels. Always inline. Never interactive. Each badge type has a fixed
`backgroundColor`/`textColor` pair — do not reuse colours across badge types
(e.g. do not use the language badge violet for a new badge category without
updating this document).

The `ignored` badge (`badge-ignored`, muted neutral) marks a repo the user has
chosen to ignore. It uses the same muted neutral family as `fork`/`archived`
because "ignored" is likewise a quiet, non-urgent state, not a new accent.
Ignored repos are hidden from the board by default, so this badge is only ever
visible while the global **show ignored** toggle is on.

### Repo owner indicator

Shown only when the board contains repos from **more than one distinct owner**
(single-owner setups already name the owner in the header, so the card stays
uncluttered). It has two parts, both coloured from the owner palette:

* **Owner stripe** — a `3px` left edge on the card (`card-owner-stripe`),
  replacing that edge's neutral border colour with the owner's palette colour.
  Reads as a quiet grouping cue down the left side of a column.
* **Owner badge** — the first chip in the card's badge row (`badge-owner`): a
  neutral pill with a small leading colour dot (palette colour) and the owner
  login in `body-sm`. The pill is neutral; only the dot carries colour.

Read-only, like all badges. The colour is identity, never urgency — see
Colors → Owner palette. Do not add a second colour to the pill body.

### Repo tags

User-assigned labels. They render as a wrapped row of chips directly below the
badge row. Each chip (`badge-tag`) is a neutral pill with a small leading colour
dot (categorical palette, hashed from the tag via `tagColor`) and the tag text
shown as `#tag` in `body-sm`. Like the owner badge, only the dot carries colour;
the chip body is neutral. The existing tag chips are read-only on the card —
tags are removed in the CardMenu and filtered from the toolbar.

The row always ends with a **"＋ tag" affordance**: a dashed-outline neutral
chip (leading `Tag` icon, label `tag`) that makes tagging discoverable without
hunting through the settings menu. It is present even on untagged cards. Clicking
it opens the CardMenu and moves focus straight to the tag input (the menu's
`autoFocusTag` path), so a tag can be typed immediately. Its accessible name is
`Add tag to <repo>` to stay distinct from the menu's plain "Add tag" submit
button.

### CardMenu (popover)

Appears on `···` click. Fixed-width `256px`. Rendered through a portal to
`document.body` and positioned `fixed`, anchored below the trigger button when
there is room or flipped above it near the viewport bottom — this keeps it from
being clipped by a column's `overflow-y-auto` scroll area or the viewport edge.
Contains these action groups, each separated by a `border-neutral-800` divider:

1. **Review timing buttons** — "Checked now", "Move to Today", "Clear check date"
2. **Priority** — a `micro` label and a four-button row (P1/P2/P3/None). The
   active level is highlighted in its priority tone; clicking it again clears
   the priority (toggle). Triage priority is an axis independent of scheduling.
3. **Per-repo review interval input** — number field + save button
4. **Tags** — a `micro` label, the repo's current tags as removable chips (each
   with an `×`), and a text field (with a `datalist` of existing tags for
   autocomplete) + "Add" button to attach a new tag. Adding an existing tag is a
   no-op. When the menu was opened via the card's "＋ tag" affordance, this input
   receives focus on open. Renders even in the tag-only (bottom-sheet) mode;
   every other group below is hidden in that mode.
5. **Flags** — a `micro` label and a wrapped row of toggle buttons, one per
   `FLAG_NAMES` entry (emoji + label from `FLAG_META`), active state
   highlighted.
6. **Ignore toggle** — a single full-width button reading "Ignore repo" /
   "Unignore repo" depending on current state.
7. **GitHub actions** — "View on GitHub ↗", copy HTTPS/SSH clone URL, "List
   open PRs" (inline expandable list, see Notices-style row treatment), "New
   issue…" (inline create form), and "Browse issues" (opens the Issues dialog
   scoped to this repo — see Issues dialog).
8. **Settings sets** — a `micro` label "Settings sets", shown only when at
   least one preset is configured (see Settings sets below the CardMenu
   section). Fetched automatically on open (it's a local read, unlike the
   GitHub actions above — no rate-limit cost to gate behind a click): a
   `presetName` / `passCount/total` header row, the count pill tinted by band
   (all-pass green, zero-pass rose, partial amber — the same danger/warning
   tokens used elsewhere, plus the green already used for `badge-public`), and
   a checklist of each check's label with a ✓/✕ mark.
9. **Notices** — a `micro` label, a multi-line text field for a new notice, an
   "Add" button (disabled while the field is empty), and a "View all (N)" link
   that opens the Notices dialog scoped to this repo. `N` is the repo's notice
   count.
10. Backdrop scrim (`fixed inset-0 z-10`) closes the menu on outside click.

Do not add new action groups without updating this document.

### Settings sets

Named policy presets that score a repo against a checklist, surfaced as a
compact `x/y` conformance summary in the CardMenu (see above). Presets are
defined in `server/settings-sets.json` — a JSON config file, not built-in code
and not a plugin/eval system — so a preset can be added or edited without a
deploy. `GET /api/settings-sets` lists presets (id/name/description/check
count); `GET /api/repos/:id/settings-sets/:presetId` evaluates one.

The shipped `hygiene` preset only checks fields already present on the synced
repo object (description, license, topics, `has_issues`, `has_wiki`) — zero
extra GitHub API calls. Checks that need real security-posture data (secret
scanning, vulnerability alerts, Dependabot, branch protection) are deferred: a
future preset needing that data should follow the existing
`ENRICH_METADATA`-gated pattern (see `enrichRepos()` in `github.js`) rather
than fetching it unconditionally, since it would cost meaningful rate-limit
budget across every tracked repo.

Each check has a `field` (a key on the repo object) and a `type` — one of
`nonEmpty`, `nonEmptyArray`, `truthy`, `falsy` (see
`server/lib/settingsSets.js`). This keeps presets a declarative JSON concern:
extending what a preset can express means adding a new evaluator type, not
executing arbitrary preset-authored code.

### Filter pills

Toggle-style buttons. **Active** = `bg-neutral-800 border-neutral-600
text-secondary`. **Inactive** = `transparent bg border-neutral-800 text-faint`.
The visual difference must be unambiguous at a glance; never use opacity alone
to distinguish states.

### Column filter

Each column carries its own text filter directly under the column header,
scoped to **that column only** — it never affects other columns or the global
toolbar filter.

* Full column width, `input` token styling (`bg-background`, `rounded.md`,
  default `border`, `border-muted` on focus), `label`-scale text, with a leading
  search glyph matching the toolbar filter.
* When the field is non-empty, a trailing **clear (`×`)** button (muted, hover
  to `text-secondary`) sits inside the right edge and resets the field on click.
* Matches the same fields as the global filter: repo name, description, language.
* When active and it hides cards, the header count chip switches to `m/N`
  (visible/total) and an empty result shows "no matches" instead of "drag here".
* Navigation aid only: it does not mutate triage state, is not persisted, and
  does not affect drag-drop targets.

### Show-ignored toggle

A single pill in the toolbar's right-hand group, styled like a filter pill
(active = `bg-neutral-800 border-neutral-600`, inactive = `transparent
border-neutral-800 text-faint`) with a leading eye-off glyph. It is **not** part
of the own/forks/archived inclusive set: it toggles whether ignored repos are
shown at all, on top of whatever the inclusive filters resolve to. Its state is
persisted in localStorage under its own key, separate from the filter pills.

### Tag filter

A toolbar button (`tags (N)` where `N` is the number of selected tags) opens a
popover (portal, `fixed`, anchored below the trigger; backdrop scrim closes it —
same pattern as the CardMenu). The popover lists every *registered* tag — not
just tags currently applied to a repo — with its usage count as checkbox rows,
plus a **match any / all** segmented toggle (shown once two or more tags are
selected) and a "clear" action. Selection narrows the board to repos matching
the chosen tags (union for "any", intersection for "all"); it composes with
the text and inclusive filters. Like the text filters, tag *selection* is a
transient query — not persisted. Tag *existence* (the registry itself) is
persisted server-side independent of any repo, so a tag can be created ahead
of use.

This popover is also the central place to manage tags, each affordance shown
only when its handler is provided:

* **Create** — a "new tag…" text field + "add" button pinned below the tag
  list, separated by a top border. Registers the tag with zero usage; it then
  appears in the list immediately, ready to be applied from any repo's
  CardMenu. A duplicate (case-insensitive) name is a silent no-op.
* **Rename** — a leading `Pencil` icon button per row (`Rename tag <tag>`)
  swaps that row for an inline text input (autofocused, autoselected) plus
  `Check`/`X` save-and-cancel icon buttons. Enter saves, Escape cancels —
  scoped to the input itself (it stops the keydown from bubbling to the
  popover's own Escape-to-close handling, so Escape cancels the edit without
  closing the whole popover). Renaming to a name that already exists **merges**
  the two tags: every repo carrying the old name ends up with the new one, and
  any `tag_rule` review-interval override moves with it.
* **Delete** — the existing trailing `Trash2` icon button (`Delete tag <tag>`)
  now arms an **inline confirm** row instead of a blocking `window.confirm` —
  the standard guard for destructive actions elsewhere in the app (see Notices
  dialog). The confirm row states the tag and affected repo count, offers a
  checkbox **"also reset check status for affected repos"**, and a rose
  "Delete" / neutral "Cancel" button pair. Checking the box clears the
  affected repos' check/anchor state (the same effect as the CardMenu's
  "Clear check date") in addition to removing the tag everywhere.

### Triage priority

An independent triage axis (separate from scheduling): **P1** (high), **P2**
(medium), **P3** (low), or none. Unlike owners/tags, the priority colour **is**
a deliberate semantic accent — a warm→cool urgency ramp (P1 rose, P2 amber, P3
sky) drawn from the state palette, not the categorical owner/tag palette. It is
the one place a non-traffic-light accent encodes urgency, and it is reserved for
this small fixed set.

* **On the card** — prioritised repos show a `badge-tag`-shaped chip at the
  start of the badge row, tinted in the priority tone (`P1`/`P2`/`P3` with a
  leading dot). Untagged-by-priority repos show nothing, so the row stays clean.
* **In the CardMenu** — the Priority group (see above) sets/toggles the level.
* **Priority filter** — a toolbar button (`priority (N)`) opens a popover (same
  portal/scrim pattern as the tag filter) with P1/P2/P3/None checkboxes. It
  narrows the board to the selected levels (level 0 = "no priority"), composing
  with every other filter. Transient — not persisted.

### Notices dialog

A modal overlay matching the Help dialog's structure (`fixed` scrim at
`z-30`, centred panel at `z-40`, Esc to close). Two scopes:

* **All repos** — opened from the toolbar **Notices** button. Shows every
  notice across all repos.
* **Single repo** — opened from a card's `CardMenu` "View all" link. Shows only
  that repo's notices; the header names the repo and offers a "show all repos"
  link to widen the scope.

Anatomy:

* Header: title, scope label, and sort controls — a **date / repo** segmented
  control plus an ascending/descending direction toggle.
* Body: a vertical list of `notices-row` items (`surface-subtle`, `rounded.md`).
  Each row shows the repo name (all-repos scope only), the notice timestamp
  (`label` scale, `text-muted`), the notice body, and a delete affordance.
* Empty state: "no notices yet" in `text-faint`.

Deleting a notice is **two-step**: the trash affordance first arms an inline
confirm (a rose "Delete" button + a neutral "Cancel"); only the explicit Delete
calls the API. This is the standard guard for destructive actions — prefer an
inline confirm over a blocking `window.confirm`.

Sort by repo name uses the same muted treatment as other metadata; do not
introduce accent colour here. The dialog reads and writes notices through the
API and refreshes the board on change so card previews and counts stay current.

### Reports dialog

A modal overlay (same structure as the Notices dialog — `z-30` scrim, centred
`z-40` panel, Esc to close), opened from the toolbar **Reports** button. The
header carries the report title and two selectors: a **kind** selector (a
wrapped row of small buttons — summary, due, never-reviewed, stale, owners,
languages, archived, active) and a **view** selector (table / markdown / csv).

* **Table view** renders the report's `columns`/`rows` as a plain bordered
  table (`label` scale, `tabular-nums`, neutral text). Empty results show "no
  matching repositories" in `text-faint`.
* **Markdown / csv view** shows the server-rendered text in a monospace `pre`
  (`surface-subtle`) with a **copy** button, for pasting into an issue/PR or a
  spreadsheet.

Read-only and neutral throughout — reports are reference data, never carry an
urgency accent. All report data comes from `/api/reports/:kind` (shared with the
`repo-triage report` CLI command).

### Issues dialog

A modal overlay (same structure as the Notices/Reports dialogs — `z-30` scrim,
centred `z-40` panel, Esc to close), opened from a card's `CardMenu` →
**GitHub actions** → "Browse issues". Always scoped to a single repo. The
all-repos equivalent is the separate **Issues overview dialog** below, not a
second mode of this component — the two differ enough (no sync controls, an
added repo column, a much larger row count) that folding them into one
component would cost more than it saves.

* **Header** — title, repo name, an **auto-sync on/off** toggle pill
  (`aria-pressed`) that flips the repo's issue-sync opt-out, and a **sync now**
  button (spinning `RefreshCw` glyph while in flight) that re-runs the sync and
  reloads. Opening the dialog itself triggers one on-demand sync in the
  background, so the list is fresh without requiring a manual click.
* **Filter row** — a search input (title + body, client-side, case-insensitive),
  an **open / closed / all** state segmented control (defaults to **open**),
  a **number / title / updated** sort segmented control, the same
  ascending/descending direction toggle used by the Notices dialog, and a
  **flagged** toggle pill (leading `Star` glyph, filled when active) that
  narrows the list to locally flagged issues only.
* **Tag row** — every label present on the repo's synced issues, rendered as
  toggle chips with a leading colour dot from the categorical palette (same
  `tagColor` hash as repo tags — issue labels are identity, not urgency).
  Multiple selected tags match with **any** semantics. Hidden entirely when the
  repo has no labelled issues.
* **Body** — a vertical list of rows (`surface-subtle` background, matching
  `notices-row`): a leading **flag** toggle (`Star` glyph — outline
  `text-neutral-600`, filled `text-neutral-100` when flagged; own button,
  separate from the row's expand button so the two hit targets never nest),
  then issue number + title, label chips, state, and a relative "updated"
  timestamp. Clicking the row body (not the flag) expands it in place to show
  the full issue body (`whitespace-pre-wrap`) and a "View on GitHub ↗" link; a
  second click collapses it. Empty state: "no matching issues" in `text-faint`.

The flag is a plain neutral toggle, not a new accent colour — it is a local,
user-chosen "show me these" marker (see Triage priority for the contrast: that
axis deliberately *is* a semantic accent, this one deliberately is not),
independent of GitHub's own issue state and never written upstream. It
survives re-sync: syncing an issue's title/body/labels never clears its flag.

Closed issues are kept locally (not dropped) specifically so this dialog can
show them — the **open** default keeps them out of the way without losing the
history. All issue data comes from the local `repo_issue` sync table via
`GET/POST /api/repos/:id/issues(/sync)`; see `server/lib/issueSync.js`.

### Dev id overlay

A development/local-only tool for pointing an AI assistant (or a human) at a
specific element during local UI debugging — not a product feature.
`DevIdOverlay.jsx` is rendered from `App.jsx` behind `import.meta.env.DEV` or
the explicit build-time opt-in `VITE_DEV_ID_OVERLAY=true`. The default
production build leaves the flag unset/false so Vite dead-code-eliminates the
overlay (component, strings, and the `tinykeys` dependency) entirely out of the
released bundle. The local `docker-compose.yml` build passes the flag so the
single-port LAN-accessible dev container can expose the same inspect overlay as
the Vite dev server.

* **Toggle** — a small `[id]`-labelled button fixed at `bottom-4 right-4`,
  `z-50` (above every dialog). `aria-pressed` reflects state; the choice
  persists to `localStorage` (`repo-triage-dev-id-overlay`) so it survives a
  reload. Also toggleable via `Ctrl+Shift+I` (via `tinykeys`), ignored while
  focus is in an `input`/`textarea`/`select`/`contenteditable` element so it
  never fires while typing.
* **Hover** — while active, `mousemove` tracks the cursor and, throttled via
  `requestAnimationFrame` (one pending frame at a time, not one timer per
  event), resolves the element under the cursor with
  `document.elementFromPoint()` and shows a small fixed tooltip next to it:
  `pointer-events: none`, high `z-50`, monospace, truncated, dark
  surface/border tokens matching every other popover. Hovering the overlay's
  own toggle button is ignored (checked via a container ref), so it never
  identifies itself.
* **Identifier** — `getElementIdentifier()` (`lib/devIdOverlay.js`, pure and
  unit-tested) prefers, in order: the hovered element's own `id` (`#foo`); its
  dev-only `data-id` attribute (`[data-id="RepoCard"]`, see below); its own
  first two class names (`tag.class-a.class-b`); a
  `data-slot`/`data-testid`/`data-component` attribute; finally the bare tag
  name. Deliberately checks the element itself only, never an ancestor — the
  whole app mounts under Vite's `<div id="root">`, so walking up to the
  "nearest" ancestor id resolves almost every element to `#root`, which
  identifies nothing useful (caught during manual verification, not left as a
  theoretical concern).
* **`data-id` attribute** (#79) — every component in `client/src/components/`
  spreads `{...devId('ComponentName')}` (`lib/devIdOverlay.js`) onto its root
  DOM node (or, for trigger+panel pairs like `CardMenu`/`TagFilter`, onto
  both the toggle button and the portal panel — same component name on each,
  since to a debugger they're "the same thing"). `devId(name)` returns
  `{ 'data-id': name }` behind `import.meta.env.DEV` or
  `VITE_DEV_ID_OVERLAY=true`, and `{}` otherwise, so the attribute — and the
  component-name string passed to it — never reaches the default production
  bundle. Hand-authored per component rather than generated via a build-time
  transform — a generator would be disproportionate tooling for a local
  debugging aid. Applied to every component, not a curated subset, so there's
  no drift list to keep in sync as components are added.
* **Copy** — while active, a **click anywhere** is intercepted (capture-phase
  listener, `preventDefault`/`stopPropagation`, skipped for clicks inside the
  overlay itself) and copies that element's identifier via
  `navigator.clipboard.writeText()`; the tooltip swaps to `copied: <id>` for
  1.2s. This is a deliberate inspect-mode trade-off — while the overlay is on,
  it owns clicks instead of the app underneath.
* **Cleanup** — the `mousemove`/`click` listeners and any pending
  `requestAnimationFrame`/copy-feedback timeout are only registered while
  active and are torn down on toggle-off or unmount (effect cleanup keyed on
  the active flag). The `Ctrl+Shift+I` listener itself is always registered
  (so the overlay can be turned on) and unsubscribed only on unmount.

### Issues overview dialog

A modal overlay (same structure as the other dialogs — `z-30` scrim, centred
`z-40` panel at a wider `max-w-4xl` to fit the added repo column, Esc to
close), opened from a new toolbar **issues** button (`ICON.issues`, same
`CircleDot` glyph as the per-repo surface) next to Reports/Notices. Lists
every locally synced issue across every repo in one place, so a user doesn't
have to open each repo's Issues dialog individually to see what's outstanding.

* **Read-only, local-only** — it reads exclusively from `GET /api/issues`
  (`server/lib/issueSync.js` → `getAllStoredIssues()`), which reads only the
  `repo_issue` table. Opening this dialog never triggers a GitHub sync or API
  call, unlike the per-repo Issues dialog's on-demand sync-on-open — this is a
  deliberate difference, not an oversight, so browsing the overview never
  spends GitHub rate-limit budget. There is accordingly no auto-sync toggle or
  "sync now" button here; use the per-repo dialog or `repo-triage-cli` /
  `POST /api/issues/sync` to refresh the underlying data.
* **Header** — title and a count line ("N synced issues across all repos").
* **Filter row** — the same search / state / sort / direction / flagged
  controls as the per-repo Issues dialog, plus a **repo** sort option (added
  to `lib/issues.js`'s `sortIssues`) so the list can be grouped by repository.
  A trailing **columns** button (`SlidersHorizontal` glyph) opens a small
  checkbox menu toggling the **status**, **activity**, and **labels** columns
  independently — title, repo name, and the flag toggle are always shown, since
  they're the point of a cross-repo list. "Activity" is time since
  `github_updated_at` (the same field the per-repo dialog calls "updated");
  there is no separate issue-age column because GitHub's issue creation date
  isn't part of the locally synced `repo_issue` schema.
* **Body** — the same row anatomy as the per-repo dialog (flag toggle, number +
  title, optional label chips) plus a repo name line under the title, and the
  optional status/activity columns trailing the row. Rows are not expandable
  (no full body / "View on GitHub" — that detail view is one click away via
  the per-repo dialog). Empty state: "no matching issues" in `text-faint`.

### Event log view

A cross-repo, **non-modal** view (#78) opened from its own toolbar **activity**
button (`ICON.activity`, lucide `Activity` glyph) next to Reports/Notices/
Issues. Split out of the per-repo Activity tab that shipped with #70 inside
`NoticesDialog` — that tab still exists for the single-repo case, but there
was no cross-repo, sortable, non-dialog surface for it until this issue.

* **Not a dialog, deliberately** — unlike every other overlay component in
  this app, `EventLogView.jsx` has no scrim/backdrop and no
  `role="dialog"`/`aria-modal`; its root is `role="region"
  aria-label="Event log"`. It still uses `useDialog()` for Escape-to-close and
  focus handling (that hook is generic, not dialog-specific), and is
  positioned identically to the modal overlays (`fixed inset-x-4 top-6`) so it
  reads as part of the same visual family — but its `z-30` sits below the
  modal dialogs' `z-40` panels, and there's no dimming layer blocking the rest
  of the app underneath.
* **Read-only, local-only** — reads exclusively from `GET /api/activity`
  (`server/lib/activity.js` → `getAllActivity()`), which reads only the
  `activity_log` table (capped at the 500 most recent rows across all repos).
  Opening this view never triggers a GitHub sync or API call, matching the
  same constraint as the issues overview dashboard.
* **Table** — a real `<table>` (not the card-list style the issues overview
  uses), matching `ListView.jsx`'s click-to-sort header pattern: **repo**,
  **action** (rendered via the shared `activitySummary()`, extracted from
  `NoticesDialog.jsx` into `lib/activitySummary.js` so both surfaces stay in
  sync), and **timestamp** (relative via `timeAgo()`, full date on hover).
  Clicking a header toggles sort direction on repeat clicks; defaults to
  timestamp, newest-first. Cross-repo scope was chosen over per-repo (the
  issue's two open questions) because a **repo** column only makes sense if
  rows span repos, and the acceptance criteria required sorting by repo.
* **Header** — title and a count line ("N events across all repos"), plus a
  close button. Empty state: "no activity yet" in `text-faint`.

### Banners

Full-width alerts in the board area (above the columns). Two variants:

* **Error** (auth invalid): `danger-bg` background, `accent-today-dim` text,
  `border-danger/60`.
* **Warning** (rate limit): `warning-bg` background, `accent-near-dim` text,
  `border-warning/40`.
* **Source warning** (owner access fell back to public, or an owner failed to
  load): uses the same **Warning** variant. Lists `sourceWarnings` from the API
  one per line. Non-fatal — the board still renders the repos that did load.

Banners are mutually exclusive with normal board rendering — they appear above
it, not instead of it.

### Rate-limit indicator

Inline in the header: `API {remaining}/{limit}`. Text colour transitions:

* `>= 100 remaining` → `text-faint` (invisible unless focused)
* `< 100 remaining` → `accent-near` (amber — caution)
* `0 remaining` → `accent-today` (rose — blocked)

Hovering reveals a tooltip with used/limit/reset-time detail.

### Mobile components

These render **only** below the mobile breakpoint (see Layout → Responsive /
mobile). They reuse existing handlers and carry no new colours.

#### Day picker (`DayPicker`)

A **calendar-icon button** in the mobile header showing the active day's short
title. Tapping it opens a dropdown/sheet listing every board column — day
columns (Today, Tomorrow, …) or, under owner/tag/language grouping, the buckets
— each as a row with the column title, subtitle, and a right-aligned repo-count
chip (`rounded.full`, `bg-neutral-800`, `label` scale — same chip as the column
header). The active row is marked with the column's accent dot. Selecting a row
sets the visible column and closes the picker. Neutral chrome throughout; the
only colour is the per-column accent dot, exactly as in the column header.

#### Move sheet (`MoveSheet`)

The long-press target for rescheduling a card — a bottom sheet titled with the
repo name. Its control is a **single numeric field**: "mark done for **N**
days" (optionally with a small row of quick-pick presets: 1, 3, 7, 14, 30).
Submitting calls the shared `onSnooze(id, days)` handler, which hits
`POST /api/repos/:id/snooze` — a **one-off snooze**. The repo resurfaces in N
days without permanently changing its review cadence. The snooze is cleared
automatically on the next check, tap, or explicit clear action. Cancel closes
without mutating. The sheet does **not** alter the per-repo inactivity override
(`/api/repos/:id/inactivity`); use the CardMenu for cadence changes. Uses
`input`/`button-primary` tokens at mobile touch-target size.

#### Mobile toolbar & action sheet

The header keeps only **search**, **sync**, and the **day picker** inline. A
single overflow trigger (`···`) opens a bottom **action sheet** containing the
remaining toolbar controls (board/list toggle, group-by, sort, density, fields,
the own/forks/archived inclusive filters + show-all, show-ignored, tag filter,
priority filter, reports, notices, issues, help). Controls keep their desktop semantics
and active/inactive styling (filter-pill pattern) but are laid out as full-width
rows at ≥ 44px height. No new control types — only relocation and resizing.

#### Bottom-sheet popovers

`CardMenu`, `TagFilter`, and `PriorityFilter` keep their desktop popover content
verbatim but render as full-width slide-up **bottom sheets** on mobile (anchored
to the bottom edge, backdrop scrim closes — same scrim pattern as the desktop
popovers). The `useDialog` focus-trap/Escape contract still applies. Action
groups, dividers, and tokens are unchanged from their desktop specs above.

## Do's and don'ts

### Do

* **Do** use the `ACCENT` map pattern in `App.jsx` for all column-specific colour
  classes. Tailwind's JIT scanner requires static string class names.
* **Do** keep descriptions `line-clamp-2`. Repo descriptions are user-authored
  and can be arbitrarily long.
* **Do** use `tabular-nums` for counters and timestamps so they don't shift width.
* **Do** express new urgency states through the existing three accent ramps
  (rose/amber/sky). Map new states to the closest semantic match.
* **Do** add new components to the **Components** section of this file before
  implementing them in code.
* **Do** respect `prefers-reduced-motion`: a global media query in `index.css`
  near-instantly resolves all animations/transitions (including the sync spinner),
  so prefer CSS `transition`/`animation` over JS-driven motion.
* **Do** keep dialogs/popovers accessible via the `useDialog` hook (focus in,
  trap, Escape, restore) with `role="dialog"` + a label, and label board groups
  (board / columns / cards) so screen-reader users can navigate structure. A
  single `role="status"` live region announces sync/load state.

### Don't

* **Don't** introduce a fourth accent colour without a design rationale and a
  corresponding update to this file.
* **Don't** add new shadow patterns broadly across the app. Keep shadows limited
  to the existing popover emphasis pattern unless this document is updated.
* **Don't** use light backgrounds, white surfaces, or `color-scheme: light`
  variants. This is a dark-only UI.
* **Don't** construct Tailwind class names dynamically (e.g. `` `text-${color}-500` ``).
  All class strings must be statically scannable.
* **Don't** use `text-transform: uppercase` outside of `micro` scale labels.
* **Don't** make column widths fluid or responsive **on desktop**. The desktop
  board is a horizontal scroll layout; columns are always `288px`. (Below the
  mobile breakpoint the board switches to a single full-width column — see
  Layout → Responsive / mobile. That is the sole exception and is layout-only.)
* **Don't** add new interactive elements to the card surface itself (other than
  the drag handle, repo link, and `···` button). Keep card interactions in the
  `CardMenu` popover.
