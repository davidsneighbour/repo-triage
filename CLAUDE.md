# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Repo·triage** — a local-only kanban dashboard for triaging GitHub repositories by priority (P1/P2/P3). Repos auto-degrade to a "Look again" column after N days of inactivity to prevent quiet rot.

## Development commands

### Local dev (two terminals, no Docker)

```bash
# Terminal 1 — backend on :8787
cd server && npm install && GITHUB_TOKEN=ghp_... npm run dev

# Terminal 2 — frontend on :5173 (proxies /api → :8787)
cd client && npm install && npm run dev
```

### Docker (production mode, single port)

```bash
docker compose --env-file .env up --build
```

Open at [http://localhost:8787](http://localhost:8787).

### Client build only

```bash
cd client && npm run build   # outputs to client/dist/
```

There are no tests.

## Environment variables

Defined in `.env` (copy from `.env.example`):

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GITHUB_TOKEN` | yes | — | Classic token needs `repo` scope for private repos |
| `GITHUB_USERNAME` | no | — | Leave blank for token owner's full set; set to load a user/org's public repos only |
| `DEFAULT_INACTIVITY_DAYS` | no | `7` | Global degradation threshold; overridable per repo in the UI |
| `DATA_DIR` | no | `/data` (Docker) / `./data` (fallback) | SQLite directory |

## Architecture

### Backend (`server/`)

**`index.js`** — Express app. Keeps GitHub repos in an in-memory `repoCache` array (refreshed at startup and on `POST /api/refresh`). Triage state lives in SQLite. `buildPayload()` merges the two at query time.

**`github.js`** — Paginates GitHub's REST API (up to 50 pages × 100 repos). Endpoint depends on whether `GITHUB_USERNAME` is set: authenticated user's endpoint (`/user/repos`) vs. public user/org endpoint (`/users/:username/repos`).

**`db.js`** — Opens `better-sqlite3` with WAL mode. Creates the `repo_state` table on startup. Only triage state is persisted (priority, timestamps, inactivity override, sort position). The repo list is never written to disk.

### Degradation logic (`server/index.js` → `effectiveState()`)

When a repo is assigned a priority, `priority_set_at` is set. On every `GET /api/repos` call, `effectiveState()` computes whether `(now − priority_set_at) >= inactivity_days`. If so, the repo's `column` becomes `look-again` and `effectivePriority` becomes `4`. The "I looked — keep priority" action (`POST /api/repos/:id/touch`) resets `priority_set_at` without changing the priority level.

### Frontend (`client/src/`)

Single-component React app (`App.jsx`). No routing, no state library. All API calls go through `api.js`, which is a thin `fetch` wrapper. After any mutation, `load()` re-fetches the full repo list from the backend.

**Columns** are defined as a static array (`COLUMNS`) in `App.jsx`. The `look-again` column is `readOnly: true` — drag-drop drops onto it are ignored; it's only populated by the server's degradation logic.

**Tailwind accent classes** are mapped via an explicit `ACCENT` object (not dynamic string construction) because Tailwind's JIT scanner needs static class strings.

### Docker build

Two-stage Dockerfile: stage 1 builds the Vite client; stage 2 is the server runtime. The client `dist/` is copied into `server/public/`, and Express serves it statically. In dev, Vite proxies `/api` to the backend instead.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/repos` | All repos merged with triage state |
| POST | `/api/refresh` | Re-fetch repo list from GitHub |
| POST | `/api/repos/:id/priority` | `{ priority: 1\|2\|3\|null }` — resets inactivity timer |
| POST | `/api/repos/:id/touch` | "I looked" — resets timer, keeps priority |
| POST | `/api/repos/:id/inactivity` | `{ days: number\|null }` — per-repo threshold override |
| POST | `/api/reorder` | `{ orderedIds: [...] }` — save column sort order |
