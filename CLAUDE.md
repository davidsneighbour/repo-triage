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
| `SYNC_ON_STARTUP` | no | `true` | Startup GitHub sync |
| `SYNC_AUTO` | no | `true` | Interval GitHub sync |
| `SYNC_INTERVAL_MINUTES` | no | `60` | Auto-sync interval, min 1 |
| `DATA_DIR` | no | `/data` (Docker), `./data` fallback | SQLite directory |

## Architecture

### Backend (`server/`)

* `index.js`: Express app, in-memory `repoCache`, schedule logic (`effectiveState`), sync loop.
* `github.js`: GitHub API pagination, multi-owner loading (`parseOwners` + per-owner fetch with org-membership detection), auth-invalid detection, rate-limit state parsing, non-fatal `sourceStatus.warnings`.
* `db.js`: SQLite setup and schema for `repo_state`.

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

Single-component React UI in `App.jsx`:

* Dynamic day columns from server config
* Sticky Today column + horizontally scrollable future columns
* Drag-drop and card menu mutations always re-fetch via `load()`
* Inclusive filters: `own`, `forks`, `archived` (persisted to localStorage)
* Header displays sync status and GitHub API remaining/limit

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/repos` | Repos + computed columns + rate-limit snapshot |
| POST | `/api/refresh` | Manual GitHub refresh |
| POST | `/api/repos/:id/check` | Set effective check age via `{ daysAgo }` |
| POST | `/api/repos/:id/inactivity` | Set per-repo review age override via `{ days }` |
| POST | `/api/repos/:id/priority` | Legacy low-level setter |
| POST | `/api/repos/:id/touch` | Reset check timestamp to now |
| POST | `/api/reorder` | Save order positions |

## Implementation constraints

* No TypeScript.
* Tailwind class names must remain static strings.
* Keep the test suites green; add/adjust tests alongside behavior changes.
* Do not cache GitHub repo list to disk.
