---
version: alpha
name: repo.triage
description: >
  A local-only day-schedule kanban dashboard for GitHub repositories.
  Dark, monospaced, high-contrast. Information density over decoration.
colors:
  # Surfaces
  background: "#0a0a0a"
  surface: "#171717"
  surface-subtle: "#0d0d0d"
  # Borders
  border: "#262626"
  border-muted: "#404040"
  # Text
  text-primary: "#f5f5f5"
  text-secondary: "#d4d4d4"
  text-muted: "#737373"
  text-faint: "#525252"
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
  help-mermaid-surface:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: 12px
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

## Overview

**Aesthetic:** Terminal minimalism. The board feels like a well-structured CLI
output rendered as a web app — not a decorative SaaS product. Monospaced
throughout. Dark, near-black surfaces. High-contrast text. Accent colours carry
semantic meaning only; they are never decorative.

**Guiding principles:**

1. **Information density over whitespace.** Every pixel should serve data or
   structure, not brand identity.
2. **Colour = signal.** Each accent colour encodes a specific urgency state.
   Do not introduce new accent colours for aesthetic reasons.
3. **Monospace everywhere.** IBM Plex Mono is the sole typeface. No serif or
   sans-serif mixing. This reinforces the developer-tool character and ensures
   tabular data (counts, timestamps) aligns naturally.
4. **Dark-only.** There is no light mode. The design is calibrated for
   `color-scheme: dark` exclusively.
5. **No broad elevation hierarchy via shadows.** Depth is primarily expressed
  through border contrast and background opacity (`/70`, `/40`).

## Colors

The palette has one dark neutral ramp and three semantic accent colours.

### Neutral ramp (surfaces, text, borders)

| Token | Hex | Role |
| --- | --- | --- |
| `background` | `#0a0a0a` | Page background (Tailwind neutral-950) |
| `surface` | `#171717` | Cards, column headers, popovers (neutral-900) |
| `border` | `#262626` | Default borders (neutral-800) |
| `border-muted` | `#404040` | Hover / focus borders (neutral-700) |
| `text-primary` | `#f5f5f5` | Headlines, repo names (neutral-100) |
| `text-secondary` | `#d4d4d4` | Body text, column headers (neutral-300) |
| `text-muted` | `#737373` | Metadata, timestamps (neutral-500) |
| `text-faint` | `#525252` | Placeholder text, empty states (neutral-600) |

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
│ ⌕ filter column...          │  ← per-column filter input (full width)
└─────────────────────────────┘
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ← drop zone (dashed border, scrolls vertically)
│  [card]                     │
│  [card]                   ↕ │  ← overflow-y-auto when cards exceed height
│  drag here                  │  ← empty state ("no matches" when filtered)
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

The count chip shows visible/total (`m/N`) when the column filter is active,
otherwise just the total.

### Card anatomy

```plaintext
┌─────────────────────────────────┐
│ repo-name                   [⋯] │
│ short description (2 lines max) │
│ [public] [live] [JavaScript]    │
│ pushed 3d ago     checked 2d ago│
│ review in 5d                    │
└─────────────────────────────────┘
```

* Card padding: `12px` (`p-3`).
* Description: `line-clamp-2`. Never wraps further.
* Badge row: flex-wrap, gap `6px`.
* Metadata row: flex row, space-between, `label` scale.

### Header

Full-width sticky bar at the top:

* Left: app name + context string (username, repo count, review cycle)
* Right: rate-limit indicator + last-synced timestamp + sync button

### Toolbar

Full-width bar below header:

* Left: text filter input (fixed `256px` width)
* Right: filter pills (own / forks / archived) + conditional "show all" button

## Elevation & depth

Depth is communicated primarily through:

1. **Border opacity** — `border-neutral-800` (default) vs `border-neutral-700`
   (hover). The difference is subtle but sufficient.
2. **Background opacity** — Cards use `bg-neutral-900/70` against the
   `#0a0a0a` page, creating a slight see-through layering effect.
3. **Backdrop blur** — Applied only to the sticky Today column wrapper
   (`backdrop-blur-sm`) to cleanly separate it from scrolled content.
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
replaces default `border`. The `···` settings button is hidden at rest (via
`group-hover` or always visible — current implementation always shows it).

### Badge

Read-only labels. Always inline. Never interactive. Each badge type has a fixed
`backgroundColor`/`textColor` pair — do not reuse colours across badge types
(e.g. do not use the language badge violet for a new badge category without
updating this document).

### CardMenu (popover)

Appears on `···` click. Fixed-width `256px`. Rendered through a portal to
`document.body` and positioned `fixed`, anchored just below the trigger button —
this keeps it from being clipped by a column's `overflow-y-auto` scroll area.
Contains three action groups:

1. **Review timing buttons** — "Checked now", "Move to Today", "Clear check date"
2. **Per-repo review interval input** — number field + save button
3. Backdrop scrim (`fixed inset-0 z-10`) closes the menu on outside click.

Do not add new action groups without updating this document.

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
* Matches the same fields as the global filter: repo name, description, language.
* When active and it hides cards, the header count chip switches to `m/N`
  (visible/total) and an empty result shows "no matches" instead of "drag here".
* Navigation aid only: it does not mutate triage state, is not persisted, and
  does not affect drag-drop targets.

### Banners

Full-width alerts in the board area (above the columns). Two variants:

* **Error** (auth invalid): `danger-bg` background, `accent-today-dim` text,
  `border-danger/60`.
* **Warning** (rate limit): `warning-bg` background, `accent-near-dim` text,
  `border-warning/40`.

Banners are mutually exclusive with normal board rendering — they appear above
it, not instead of it.

### Rate-limit indicator

Inline in the header: `API {remaining}/{limit}`. Text colour transitions:

* `>= 100 remaining` → `text-faint` (invisible unless focused)
* `< 100 remaining` → `accent-near` (amber — caution)
* `0 remaining` → `accent-today` (rose — blocked)

Hovering reveals a tooltip with used/limit/reset-time detail.

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
* **Don't** make column widths fluid or responsive. The board is a horizontal
  scroll layout; columns are always `288px`.
* **Don't** add new interactive elements to the card surface itself (other than
  the drag handle, repo link, and `···` button). Keep card interactions in the
  `CardMenu` popover.
