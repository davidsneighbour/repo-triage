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

### Docker — local build

```bash
docker compose --env-file .env up --build
```

Open: [http://localhost:8787](http://localhost:8787)

### Docker — production image from GHCR (end-user path)

No local checkout required. Pull the pre-built image published on each release:

```bash
# download the compose file once
curl -O https://raw.githubusercontent.com/davidsneighbour/repo-triage/main/docker-compose.prod.yml
# create a .env with at minimum GITHUB_TOKEN=ghp_...
docker compose -f docker-compose.prod.yml up -d
```

Pin to a specific release with `IMAGE_TAG=1.2.3 docker compose -f docker-compose.prod.yml up -d`.

The image is published to `ghcr.io/davidsneighbour/repo-triage` automatically
by `.github/workflows/docker-publish.yml` whenever `npm run release` creates a `v*` tag.

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
| `DEFAULT_INACTIVITY_DAYS` | no | `7` | Due age in days for Today |
| `DAY_ROLLOVER_HOUR` | no | `4` | Hour (0-23, local) when "tomorrow" becomes "today" on the board |
| `SYNC_ON_STARTUP` | no | `true` | Startup GitHub sync |
| `SYNC_AUTO` | no | `true` | Interval GitHub sync |
| `SYNC_INTERVAL_MINUTES` | no | `60` | Auto-sync interval, min 1 |
| `DATA_DIR` | no | `/data` (Docker), `./data` fallback | SQLite directory |
| `ENRICH_METADATA` | no | `false` | Run per-repo GraphQL enrichment after each sync (open PRs, latest release, last commit, CI status). Requires `gh` CLI to be logged in. Costs rate-limit budget. |
| `PAGINATE_VIA_GH` | no | `false` | Route repo-list pagination through `gh api --paginate` instead of REST. Org/membership detection stays on REST. Rate-limit state is refreshed via one REST call after each gh sync. |
| `ISSUE_SYNC_INTERVAL_MINUTES` | no | `10080` (7 days) | Periodic GitHub issue sync interval for tracked repos (opt-out per repo via `PUT /api/repos/:id/issue-sync`). Does not run on server startup — only on this interval or via on-demand/manual sync. |

## Architecture

### Backend (`server/`)

* `index.js`: Express app, in-memory `repoCache`, schedule logic (`effectiveState`), sync loop.
* `github.js`: GitHub API pagination, multi-owner loading (`parseOwners` + per-owner fetch with org-membership detection), auth-invalid detection, rate-limit state parsing, non-fatal `sourceStatus.warnings`. `enrichRepos()` runs opt-in per-repo GraphQL enrichment via `gh api graphql` after each sync.
* `db.js`: Opens the SQLite connection, sets WAL mode, and runs pending migrations via `lib/migrations.js`.
* `lib/migrations.js`: Schema migration registry and runner. See **Database migrations** below.
* `lib/issueSync.js`: Sync engine for per-repo GitHub issues, stored in the `repo_issue` table. `syncRepoIssues()`/`syncAllRepoIssues()` back all three trigger modes (periodic interval, on-demand, manual); opt-out per repo via `repo_state.issue_sync_enabled`; stops early and warns (`issueSyncStatus.warnings`) if the shared rate-limit budget runs low. `setIssueFlagged()` sets a local-only, never-upstream priority marker on a synced issue (`repo_issue.flagged`) that the sync upsert never touches, so it survives re-sync. `getAllStoredIssues()` backs the cross-repo issues overview — reads only `repo_issue`, never syncs.
* `lib/settingsSets.js`: Loads named policy presets from `settings-sets.json` (JSON config, not built-in code or a plugin system) and scores a repo against a preset's checks (`evaluatePreset()`). Each check is declarative — a `field` on the repo object plus an evaluator `type` (`nonEmpty`/`nonEmptyArray`/`truthy`/`falsy`) — not arbitrary code. The shipped `hygiene` preset only reads fields already on the synced repo object, so evaluating it costs no GitHub API calls.

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

## Database migrations

Schema history lives in `server/lib/migrations.js` as an ordered array of
migration objects. The runner uses `PRAGMA user_version` (a 32-bit integer in
the SQLite header) to track the highest applied version. On startup `db.js`
calls `runMigrations(db)` before any route module prepares statements.

### Version numbering

Use the format `yyyymmddNN` — the date the migration is written plus a
two-digit counter (e.g. `2026062001` = 20 June 2026, first migration of the
day). This sorts lexicographically and makes history auditable.

### How to add a migration

1. Open `server/lib/migrations.js`.
2. Append a new entry to the `MIGRATIONS` array **after** all existing entries:

   ```js
   {
     version: 2026062002,          // yyyymmddNN — must be > all existing versions
     description: 'add foo column to repo_state',
     up(db) {
       // Use better-sqlite3 synchronous APIs only.
       // Guard ALTER TABLE ADD COLUMN with a PRAGMA table_info check so the
       // migration is safe to re-run against a DB that already has the column.
       const cols = db.prepare('PRAGMA table_info(repo_state)').all().map(c => c.name);
       if (!cols.includes('foo')) {
         db.exec(`ALTER TABLE repo_state ADD COLUMN foo TEXT`);
       }
     },
   },
   ```

3. Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for any
   new tables or indexes — never bare `CREATE TABLE`.
4. Add a test in `server/migrations.test.js` covering the new migration.

### Rules

* **Never mutate an existing migration.** Once committed, a migration is
  permanent history. Fix mistakes with a new migration.
* **Keep each migration small and self-describing.** One logical change per
  entry.
* **A failed migration aborts startup.** The runner throws before the HTTP
  server binds, so a broken migration is obvious immediately.
* **`/api/health` exposes `schemaVersion`.** The current `user_version` integer
  appears in the health response for debugging and deployment verification.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness/readiness probe (status, cacheReady, repoCount, uptime, schemaVersion) |
| GET | `/api/repos` | Repos + computed columns + rate-limit snapshot |
| POST | `/api/refresh` | Manual GitHub refresh |
| POST | `/api/repos/:id/check` | Set effective check age via `{ daysAgo }` |
| POST | `/api/repos/:id/inactivity` | Set per-repo review age override via `{ days }` |
| POST | `/api/repos/:id/snooze` | One-off snooze via `{ days }`. Resurfaces in N days without changing review cadence. Cleared on check, tap, or clear. |
| POST | `/api/repos/:id/priority` | Set triage priority via `{ priority: 1\|2\|3\|null }` (independent of scheduling) |
| POST | `/api/repos/:id/clear` | Clear the scheduling state (anchor + checked_at); keeps priority |
| POST | `/api/repos/:id/touch` | Reset check timestamp to now |
| POST | `/api/reorder` | Save order positions |
| DELETE | `/api/tags/:tag` | Delete a tag from every repo that carries it |
| GET | `/api/backup` | Export all triage state (repo_state/notice/tag) as JSON |
| POST | `/api/restore` | Replace all triage state from a backup payload (transactional) |
| GET | `/api/backup/full` | Stream a gzip-compressed, redacted snapshot of the whole SQLite DB (every table, incl. `settings`/`prefs`; `tokens` rows are stripped and the copy is VACUUMed before compression). Additive to `/api/backup`, not a replacement. |
| POST | `/api/repos/:id/gh/open` | Open repo in browser via `gh repo view --web` |
| GET | `/api/repos/:id/gh/prs` | List open PRs via `gh pr list` |
| POST | `/api/repos/:id/gh/issue` | Create GitHub issue via `gh issue create`; body `{ title, body }` |
| GET | `/api/settings` | Read effective settings (env defaults + DB overrides: defaultInactivityDays, syncIntervalMinutes, githubOwners) |
| PUT | `/api/settings` | Write runtime setting overrides; unknown keys stripped; owners change triggers re-sync |
| GET | `/api/prefs` | Read persisted view/display prefs blob (density, sort, view, groupBy, fields, filters, showIgnored) |
| PUT | `/api/prefs` | Write view/display prefs blob (unknown keys stripped) |
| GET | `/api/repos/:id/issues` | Locally stored synced GitHub issues for a repo + `syncEnabled` |
| POST | `/api/repos/:id/issues/sync` | On-demand/manual single-repo issue refresh (fetch + upsert into `repo_issue`) |
| PUT | `/api/repos/:id/issue-sync` | Enable/disable issue sync for a repo via `{ enabled }` (opt-out, enabled by default) |
| POST | `/api/issues/sync` | Manual refresh-all: syncs issues for every opted-in tracked repo |
| POST | `/api/repos/:id/issues/:number/flag` | Set/clear a local-only priority flag on a synced issue via `{ flagged }`; 404 if the issue hasn't been synced yet. Never written upstream; survives re-sync. |
| GET | `/api/settings-sets` | List configured policy presets (id/name/description/checkCount) from `settings-sets.json` |
| GET | `/api/repos/:id/settings-sets/:presetId` | Evaluate one repo against one preset's checks; returns `{ presetId, presetName, checks, passCount, total }` |

## Implementation constraints

* No TypeScript.
* Tailwind class names are static strings (no dynamic construction).
* Keep the test suites green; add/adjust tests alongside behaviour changes.
* Do not cache GitHub repo list to disk.
