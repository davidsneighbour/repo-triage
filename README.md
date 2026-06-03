# Repo·triage

Repo·triage is a local-only day-schedule kanban for GitHub repositories. Every
repo is placed in a day column by last review age. Once a repo reaches the due
age (`DEFAULT_INACTIVITY_DAYS`), it returns to **Today** automatically.

## Features

* Day-based board: **Today + N-1 future weekday columns**
* Drag-drop scheduling by day column
* Per-repo review cycle override
* Inclusive repository filtering (`own`, `forks`, `archived`)
* Auto-sync with GitHub on startup and/or interval
* Live GitHub API rate-limit status and token validity feedback
* SQLite persistence for triage state only (repo catalog is always from GitHub)

## Quick start

1. Copy `.env.example` to `.env` and set `GITHUB_TOKEN`.
2. Run:

```bash
docker compose --env-file .env up --build
```

1. Open [http://localhost:8787](http://localhost:8787)

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | yes | none | GitHub API auth token |
| `GITHUB_USERNAME` | no | empty | If set, load only that user/org public repos |
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

Filter settings persist in browser `localStorage`.

## Help panel (F1)

The dashboard ships with an in-app help panel backed by Markdown content.

Keyboard contract:

* `F1` opens the help panel.
* `Esc` closes the help panel.

Rendering boundaries:

* Help content is loaded from `client/src/help.md`.
* Markdown is rendered via `react-markdown` + `remark-gfm`.
* Fenced `mermaid` code blocks are rendered as diagrams when Mermaid succeeds.
* If Mermaid rendering fails, the panel shows a warning and keeps the Markdown
    text visible.

## GitHub API behavior

* Repo fetching is paginated (`/user/repos` or `/users/:username/repos`)
* Rate-limit headers are tracked server-side and exposed in `GET /api/repos`
* If token is invalid/expired (`401`), UI shows an auth error banner
* If rate limit is exhausted, refresh is blocked until reset time

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
    index.js   Express API, schedule computation, sync loop
    github.js  GitHub API client + rate-limit/auth state
    db.js      SQLite schema and connection

client/
    src/App.jsx  Single-page UI (board, filters, drag/drop, menus)
    src/api.js   Fetch wrappers for API routes
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/repos` | Board payload + sync/rate-limit status |
| POST | `/api/refresh` | Trigger manual GitHub refresh |
| POST | `/api/repos/:id/check` | `{ daysAgo }` set effective last-check age |
| POST | `/api/repos/:id/inactivity` | `{ days }` set per-repo review-cycle override |
| POST | `/api/repos/:id/priority` | Legacy low-level state setter (used for clear) |
| POST | `/api/repos/:id/touch` | Reset `priority_set_at` to now |
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
npm run cli -- list --json | jq '.[].full_name'    # machine-readable
npm run cli -- tag add me/dotfiles ci oss          # add tags
npm run cli -- check me/dotfiles --days 0          # mark reviewed now
npm run cli -- ignore me/old-thing                 # hide from the board
npm run cli -- note add me/api "rotate the token"  # attach a notice
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
