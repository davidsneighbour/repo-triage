# Repo·triage

Repo·triage is a local-only day-schedule kanban for GitHub repositories. Every
repo is placed in a day column by last review age. Once a repo reaches the due
age (`DEFAULT_INACTIVITY_DAYS`), it returns to **Today** automatically.

## Features

* Day-based board: **Today + N-1 future weekday columns**
* Drag-drop **and keyboard** scheduling (`[` / `]` move the focused card)
* Per-repo review cycle override; honest "checked today / Nd ago" age
* Load from **multiple users and orgs** (`GITHUB_OWNERS`); per-card owner badge
* **Tags** (chips + toolbar filter), **triage priority** (P1/P2/P3 with its own
  filter), **notices** (timestamped notes), and an **ignore** flag with a global
  show-ignored toggle
* Inclusive repository filtering (`own`, `forks`, `archived`) + per-column filter
* Group the board by day schedule, owner, tag, or language; sort cards within
  columns (name / recently pushed / stars / due)
* **Reports** (overdue / stale / per-owner / …) viewable in-app or exported as
  Markdown/CSV, shared with the **`repo-triage` CLI**
* Auto-sync with GitHub on startup and/or interval (background, non-blocking)
* Live GitHub API rate-limit status and token validity feedback
* Accessible: focus-trapped dialogs, ARIA roles, live region, reduced-motion
* SQLite persistence for triage state only (repo catalog is always from GitHub)

## Quick start

1. Copy `.env.example` to `.env` and set `GITHUB_TOKEN` (or just run
   `gh auth login` — the server falls back to `gh auth token`).
2. Run:

```bash
docker compose --env-file .env up --build
```

1. Open [http://localhost:8787](http://localhost:8787)

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | no* | none | GitHub API auth token. *If unset, falls back to `gh auth token` (run `gh auth login`) |
| `GITHUB_OWNERS` | no | empty | Users/orgs to load. Comma list or JSON array. Blank = the token owner's full set. Own login / member orgs include private; other users/orgs are public-only (a warning is shown) |
| `GITHUB_USERNAME` | no | empty | Deprecated single-owner alias for `GITHUB_OWNERS` |
| `DEFAULT_INACTIVITY_DAYS` | no | `7` | Due age in days for returning a repo to Today |
| `SYNC_ON_STARTUP` | no | `true` | Fetch GitHub repos when server starts |
| `SYNC_AUTO` | no | `true` | Enable periodic background sync |
| `SYNC_INTERVAL_MINUTES` | no | `60` | Sync interval minutes (min 1) |
| `DATA_DIR` | no | `/data` in Docker, `./data` fallback | SQLite data directory |

### Token scopes

* Classic token: `repo` scope for private repos
* Fine-grained token: read access to repository metadata

## Day-Schedule model

`DEFAULT_INACTIVITY_DAYS` is the due-age threshold, not the number of
degradation steps. The board displays exactly `DEFAULT_INACTIVITY_DAYS` columns:

* `day-0`: **Today** (due now)
* `day-1..day-(N-1)`: future weekday columns

Rules:

* Never checked => Today
* Checked age >= N days => Today
* Checked age < N days => one of the future day columns

Card actions:

* **Checked now** => moves to furthest future column
* **Move to Today** => moves immediately to Today
* **Clear check date** => treated as never checked (Today)

### Per-repo inactivity values larger than default

When a repo override (`inactivity_days`) is greater than
`DEFAULT_INACTIVITY_DAYS`, two things happen:

* **Where it is shown:** The board still has only `DEFAULT_INACTIVITY_DAYS`
    columns, so the repo is visually clamped to the furthest future column
    (`day-(N-1)`).
* **When it decays:** Internally, `dueInDays` keeps counting down from the
    larger override value. Once the effective offset reaches `0` or below, the
    repo returns to `day-0` (Today).

Example with `DEFAULT_INACTIVITY_DAYS=7` and repo override `14`:

* immediately after check: shown in `day-6`, `review in 14d`
* after 8 days: still shown in `day-6`, `review in 6d`
* at 14+ days age: shown in `day-0` (due today)

## Filtering model

Each repo can independently be:

* own or fork
* live or archived

Toolbar filters are **inclusive unions**. A repo is shown if it matches at
least one enabled category:

* `own`: non-fork and non-archived
* `forks`: any fork (live or archived)
* `archived`: any archived repo (own or fork)

Examples:

* `own` only => own live repos
* `own + archived` => all non-fork repos (own live + own archived)
* `forks` only => all fork repos (fork live + fork archived)
* all enabled => all repos

On top of these inclusive filters sit three **independent** narrowing axes that
compose with the unions (and each other): the text search, the **tag** filter,
and the **priority** filter (P1/P2/P3/None). Triage priority is its own axis,
unrelated to the day-schedule — set it from a card's menu (or the CLI) and use
the toolbar `priority` popover to focus on, say, just P1 + P2.

The inclusive own/forks/archived settings persist in browser `localStorage`; the
search, tag, and priority filters are transient per-session queries.

## Help panel (F1)

The dashboard ships with an in-app **user guide** — an extensive walkthrough of
every feature (board model, scheduling, priority, tags, notices, ignore,
filtering, display, reports, sync/auth/owners, keyboard shortcuts), a full CLI
command reference, and a configuration-variable table.

Open it two ways:

* Press `F1`, or
* Click the **Help** button in the header.

Keyboard:

* `F1` opens / `Esc` closes the help panel.
* `]` / `[` move the focused repo card one column further out / toward Today.
* Dialogs trap focus and restore it to the trigger on close.

Rendering boundaries:

* Help content is loaded from `client/src/help.md` (`react-markdown` + `remark-gfm`,
  with renderers for headings, lists, links, tables and code).
* The flow diagram is **pre-rendered to a static SVG at build time**
    (`client/src/help-diagram.svg` via `scripts/build-help-diagram.mjs`) — Mermaid
    is never run in the browser.

## GitHub API behavior

* Auth resolves `GITHUB_TOKEN`, else `gh auth token`; the active source is
    reported as `authSource` in `GET /api/repos`.
* With no `GITHUB_OWNERS`, the token owner's repos are fetched (`/user/repos`,
    private included). With owners configured, each is loaded individually — your
    own login and member orgs include private repos; other users/orgs are
    public-only and add a non-fatal `sourceWarnings` entry.
* Fetching is paginated; rate-limit headers are tracked server-side and exposed
    in `GET /api/repos`; `401` shows an auth banner; an exhausted limit blocks
    refresh until reset.

## Cache-first startup behavior

The client stores the latest successful board payload in browser `localStorage`
(`repo-triage-board-cache-v1`). On next load:

1. Cached board data is rendered immediately (if available).
2. A background request fetches the latest API payload.
3. The UI replaces cached content with the fresh response and updates cache.

Acceptance criteria:

* Existing cached repos are visible before the first API call resolves.
* A short "showing cached board" hint is visible while refresh is in-flight.
* Once the API returns, cached content is replaced by fresh payload data.
* If no cache exists, startup behavior remains the normal loading state.

## Architecture

```plaintext
server/
    index.js    Express API, payload merge, sync loop, routes
    github.js   Multi-owner fetch (gh-token fallback), rate-limit/auth state
    schedule.js effectiveState() — board placement from checked_at/anchor
    report.js   Report builder + markdown/csv formatters
    db.js       SQLite schema (repo_state, repo_notice, repo_tag)

client/
    src/App.jsx  Single-page UI (board, filters, dialogs, menus)
    src/api.js   Fetch wrappers for API routes
    src/lib/     board/date/useDialog helpers

cli/
    repo-triage.mjs  Zero-dependency CLI over the HTTP API
```

Stack: Express 5 + better-sqlite3 (`server/`), React 19 + Vite 8 + Tailwind v4
(`client/`), Vitest across all three workspaces.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness/readiness probe (status, cacheReady, repoCount, uptime) |
| GET | `/api/repos` | Board payload + sync/rate-limit/auth/owner status |
| POST | `/api/refresh` | Queue a background GitHub refresh (non-blocking) |
| POST | `/api/repos/:id/check` | `{ daysAgo }` set effective last-check age |
| POST | `/api/repos/:id/inactivity` | `{ days }` per-repo review-cycle override |
| POST | `/api/repos/:id/priority` | `{ priority: 1\|2\|3\|null }` set triage priority (independent of scheduling) |
| POST | `/api/repos/:id/clear` | Clear the schedule (anchor + check date); keeps priority |
| POST | `/api/repos/:id/touch` | Reset the check timestamp to now |
| GET | `/api/backup` | Export all triage state (state/notices/tags) as JSON |
| POST | `/api/restore` | Replace all triage state from a backup (transactional) |
| POST | `/api/repos/:id/ignore` | `{ ignored }` hide/show a repo |
| GET/POST/DELETE | `/api/repos/:id/notices` | List / add / (delete via `/api/notices/:id`) notes |
| GET | `/api/notices` | All notices, sortable |
| GET/POST | `/api/repos/:id/tags` · DELETE `/.../tags/:tag` | Per-repo tags |
| GET | `/api/tags` | Distinct tags with counts |
| GET | `/api/reports` · `/api/reports/:kind` | Report kinds / a report (`?format=json\|md\|csv`) |
| POST | `/api/reorder` | Persist column order |

## Release notes (prototype)

The prototype is release-ready for local/self-hosted use with:

* persistent triage state
* robust GitHub auth/rate-limit handling
* configurable sync policy
* complete design contract in `DESIGN.md`
* agent tooling contract in `AGENTS.md` and `.github/copilot-instructions.md`

## Development

Run both backend (`:8787`) and frontend (`:5173`) together, no Docker needed:

```bash
npm install && npm run dev
```

The backend auto-loads the root `.env`, so set `GITHUB_TOKEN` there.
`npm run server` runs only the backend. You can still run each side in its own
terminal if you prefer:

```bash
# backend
cd server && npm install && npm run dev

# frontend
cd client && npm install && npm run dev
```

## CLI (`repo-triage`)

A zero-dependency Node CLI in `cli/` scripts triage state by talking to the
local API (the server must be running). Run it with `npm run cli -- <command>`
or `node cli/repo-triage.mjs <command>` (or install the `repo-triage` bin).

```bash
npm run cli -- list --owner dnbhq --tag infra      # filter + list
npm run cli -- list --priority 1,2                 # only P1/P2 repos
npm run cli -- list --json | jq '.[].full_name'    # machine-readable
npm run cli -- tag add me/dotfiles ci oss          # add tags
npm run cli -- priority me/api 1                   # set triage priority P1
npm run cli -- check me/dotfiles --days 0          # mark reviewed now
npm run cli -- ignore me/old-thing                 # hide from the board
npm run cli -- note add me/api "rotate the token"  # attach a notice
npm run cli -- report stale --days 365             # markdown report
npm run cli -- backup > triage-backup.json         # export all triage state
npm run cli -- restore triage-backup.json          # re-import it
npm run cli -- report owners --format csv > o.csv   # export csv
```

A repo is `owner/name` (or a bare `name` when unambiguous). Override the API URL
with `--api` or `REPO_TRIAGE_API`. Run `repo-triage help` for the full command
list. GitHub auth stays server-side, so the CLI never needs its own token.

## Testing

```bash
npm run test           # all client + server + cli tests (Vitest), no Docker
npm run test:coverage  # same, with coverage report + enforced thresholds
```

* `client/`: Vitest + jsdom + React Testing Library (component/behavior tests).
* `server/`: Vitest with in-process route tests via `supertest`, plus pure
    schedule/GitHub-client unit tests.
* Coverage thresholds live in each `vitest.config.js` and fail the run on
    regression.
