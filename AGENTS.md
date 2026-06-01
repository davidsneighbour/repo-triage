# AGENTS.md

Guidance for AI agents (Claude Code, Codex, Copilot, etc.) working in this repository.

## What this repo is

A local-only GitHub repository triage dashboard. Backend is Node.js/Express + SQLite. Frontend is React + Tailwind built with Vite. Deployed as a single Docker container.

## Key constraints

- **No tests exist.** Do not reference or scaffold a test suite unless the user explicitly asks for one.
- **No TypeScript.** The project is plain JavaScript (ESM). Do not convert files or add type annotations.
- **SQLite is the only persistence layer.** Only triage state lives there — never cache the GitHub repo list to disk.
- **In-memory repo cache.** `repoCache` in `server/index.js` is the source of truth for repo metadata at runtime. Any route that needs repo data reads from this array, not the database.
- **Tailwind class names must be static strings.** Dynamic class construction (template literals, computed keys) will be stripped by the JIT scanner. Use the `ACCENT` map pattern already in `App.jsx` when adding new color variants.

## Where things live

- `server/index.js` — Express routes, degradation logic (`effectiveState`), in-memory cache
- `server/db.js` — SQLite setup and schema (single table: `repo_state`)
- `server/github.js` — GitHub API pagination
- `client/src/App.jsx` — entire UI (columns, cards, drag-drop, menus)
- `client/src/api.js` — thin `fetch` wrappers for all API routes
- `data/dashboard.db` — SQLite file (gitignored, Docker-mounted volume)

## Development workflow

```bash
# Backend (port 8787)
cd server && npm run dev

# Frontend (port 5173, proxies /api to backend)
cd client && npm run dev

# Production (Docker, single port 8787)
docker compose --env-file .env up --build
```

## Degradation model

Priority assignment sets `priority_set_at`. `effectiveState()` in `server/index.js` computes column placement at read time — no background job. The threshold is `inactivity_days` (per-repo override) or `DEFAULT_INACTIVITY_DAYS` (env var, default 7). Degraded repos land in column `look-again` (priority 4, read-only in the UI).

## Adding a new API route

1. Add the Express handler in `server/index.js`.
2. Add a corresponding method in `client/src/api.js`.
3. Call the method in `App.jsx` and follow the `mutate(() => api.foo()).then(load)` pattern so the UI refreshes from the server after every mutation.

## Environment variables

`GITHUB_TOKEN` is required. `GITHUB_USERNAME` is optional (blank = token owner's full repo set including private). See `.env.example` for all variables.
