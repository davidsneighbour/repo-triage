# CLAUDE.Md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Design contract

`DESIGN.md` is the binding source of truth for all UI and visual decisions.
Before changing anything under `client/`, read and follow `DESIGN.md`.

## Project overview

Repo·triage is a local-only dashboard for triaging GitHub repositories on a
**day schedule**. Repositories are bucketed by last-check age into Today plus
future weekday columns. Repos due at or beyond the configured review age return
to Today automatically.

## Development commands

### Local dev (one command)

```bash
# from the repo root: backend :8787 + frontend :5173 together
npm install && npm run dev
```

`npm run dev` runs the backend and frontend concurrently. The backend
auto-loads the root `.env` (`--env-file-if-exists`), so put `GITHUB_TOKEN`
there. `npm run server` runs just the backend.

### Local dev (two terminals)

```bash
# backend on :8787
cd server && npm install && GITHUB_TOKEN=ghp_... npm run dev

# frontend on :5173 (proxies /api → :8787)
cd client && npm install && npm run dev
```

### Docker (single port)

```bash
docker compose --env-file .env up --build
```

Open: [http://localhost:8787](http://localhost:8787)

### Client production build

```bash
cd client && npm run build
```

### Tests

```bash
npm run test           # all unit/route tests (client + server), no Docker
npm run test:coverage  # same, with v8 coverage + enforced thresholds
```

Vitest powers both workspaces: `client/` uses jsdom + React Testing Library,
`server/` runs in-process route tests via `supertest`. Coverage thresholds are
set in each `vitest.config.js` and fail the run on regression.

## Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | no* | none | Classic token needs `repo` scope for private repos. *If unset, falls back to `gh auth token` (requires `gh auth login`) |
| `GITHUB_OWNERS` | no | empty | Users/orgs to load. Comma list or JSON array. Blank = token owner's full set. Own login / member orgs include private; other users/orgs are public-only (warning shown) |
| `GITHUB_USERNAME` | no | empty | Deprecated single-owner alias for `GITHUB_OWNERS` (used only when `GITHUB_OWNERS` is unset) |
| `DEFAULT_INACTIVITY_DAYS` | no | `7` | Due age in days for Today |
| `DAY_ROLLOVER_HOUR` | no | `4` | Hour (0-23, local) when "tomorrow" becomes "today" on the board |
| `SYNC_ON_STARTUP` | no | `true` | Startup GitHub sync |
| `SYNC_AUTO` | no | `true` | Interval GitHub sync |
| `SYNC_INTERVAL_MINUTES` | no | `60` | Auto-sync interval, min 1 |
| `DATA_DIR` | no | `/data` (Docker), `./data` fallback | SQLite directory |
| `ENRICH_METADATA` | no | `false` | Run per-repo GraphQL enrichment after each sync (open PRs, latest release, last commit, CI status). Requires `gh` CLI to be logged in. Costs rate-limit budget. |

## Architecture

### Backend (`server/`)

* `index.js`: Express app, in-memory `repoCache`, schedule logic (`effectiveState`), sync loop.
* `github.js`: GitHub API pagination, multi-owner loading (`parseOwners` + per-owner fetch with org-membership detection), auth-invalid detection, rate-limit state parsing, non-fatal `sourceStatus.warnings`. `enrichRepos()` runs opt-in per-repo GraphQL enrichment via `gh api graphql` after each sync.
* `db.js`: SQLite setup and schema for `repo_state`, `repo_notice`, `repo_tag`.

### CLI (`cli/`)

* `repo-triage.mjs`: zero-runtime-dependency Node CLI that scripts triage state via the HTTP API (`list`, `ignore`, `check`, `clear`, `priority`, `tag`, `note`, `backup`, `restore`, …). Server must be running. Exposes pure helpers (`parseArgs`/`resolveRepo`/`filterReposCli`/`formatList`/`run`) for tests. `npm run cli -- <command>`.

### Data model

* `repoCache` (memory) is source of truth for repository metadata.
* SQLite stores only triage state (`priority_set_at`, `inactivity_days`, `position`, etc.).
* `buildPayload()` merges memory + SQLite per request.

### Day schedule logic

`effectiveState()` computes board placement at read time:

* No `priority_set_at` => `day-0` (Today)
* Age >= inactivity threshold => `day-0`
* Otherwise => future bucket `day-k`

Board width is `DEFAULT_INACTIVITY_DAYS` columns total:

* Today (`day-0`)
* `DEFAULT_INACTIVITY_DAYS - 1` future weekday columns

### Frontend (`client/src/`)

React UI split into a container plus one-component-per-file:

* `App.jsx`: the container — data loading/polling, all board state + persisted
  view prefs (filters, density, sort, group-by, fields), and the header/toolbar.
  Re-exports `ownerColor`/`tagColor`/`PRIORITY_*` for back-compat.
* `components/`: `Column`, `RepoCard`, `CardMenu`, `Badge`, `ListView` (table
  view), `BulkBar` (multi-select actions), `Toast` (undo), the dialogs
  (`HelpDialog`, `NoticesDialog`, `ReportsDialog`), and the toolbar menus
  (`TagFilter`, `PriorityFilter`, `FieldsMenu`).
* `lib/constants.js`: shared UI constants/helpers (`cx`, `ACCENT`, `ICON`,
  `ownerColor`/`tagColor`, `PRIORITY_*`, label maps, `FIELD_OPTIONS`).
* `lib/boardCache.js`: localStorage board-cache helpers + `EMPTY_DATA`.
* `lib/board.js`, `lib/date.js`, `lib/useDialog.js`: pure board logic, date
  formatting, and the dialog focus-trap hook.

Behaviour: dynamic day columns from server config; sticky Today column +
horizontally scrollable future columns; drag-drop and card-menu mutations
always re-fetch via `load()`; inclusive filters (`own`/`forks`/`archived`,
persisted); header shows sync status and GitHub API remaining/limit.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness/readiness probe (status, cacheReady, repoCount, uptime) |
| GET | `/api/repos` | Repos + computed columns + rate-limit snapshot |
| POST | `/api/refresh` | Manual GitHub refresh |
| POST | `/api/repos/:id/check` | Set effective check age via `{ daysAgo }` |
| POST | `/api/repos/:id/inactivity` | Set per-repo review age override via `{ days }` |
| POST | `/api/repos/:id/priority` | Set triage priority via `{ priority: 1\|2\|3\|null }` (independent of scheduling) |
| POST | `/api/repos/:id/clear` | Clear the scheduling state (anchor + checked_at); keeps priority |
| POST | `/api/repos/:id/touch` | Reset check timestamp to now |
| POST | `/api/reorder` | Save order positions |
| DELETE | `/api/tags/:tag` | Delete a tag from every repo that carries it |
| GET | `/api/backup` | Export all triage state (repo_state/notice/tag) as JSON |
| POST | `/api/restore` | Replace all triage state from a backup payload (transactional) |

## Implementation constraints

* No TypeScript.
* Tailwind class names must remain static strings.
* Keep the test suites green; add/adjust tests alongside behaviour changes.
* Do not cache GitHub repo list to disk.
