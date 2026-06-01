# repo·triage

A local-only dashboard that lists **all** your GitHub repositories as a kanban
board and lets you triage them by priority. Priorities decay: a repo assigned
**P1–P3** stays put until it goes untouched for *N* days, then it auto-moves to
the **"Look again"** column so nothing quietly rots.

- Lists every repo for the configured account (public + private, live + archived)
- Click a card's `⋯` for a **priority dropdown (P1 / P2 / P3 / Inbox)** + per-repo
  inactivity setting
- **Drag a card to a column** to move it to that state
- Each repo can have its own degrade-after-N-days threshold (default is global)
- State stored in **SQLite**; repo list always fetched live from GitHub
- React + Tailwind frontend, Express backend, one Docker container

## Run it

The token is read from your `~/.env` (which must contain `GITHUB_TOKEN=...`):

```bash
docker compose --env-file ~/.env up --build
```

Then open http://localhost:8787

> `--env-file ~/.env` lets Compose read the token from your home file without
> copying it into the project. Alternatively, copy `.env.example` to `.env` here.

### Token scopes
- **Classic token:** needs the `repo` scope to read private repositories.
- **Fine-grained token:** needs read access to repository metadata.

### Targeting a different account
Leave `GITHUB_USERNAME` blank to load *your* full set (the token owner's repos,
including private + archived). Set it to a username/org to load that account's
**public** repos only — GitHub never exposes someone else's private repos.

## How degradation works
When you set a priority (via the dropdown or by dragging), the inactivity timer
resets. Each repo degrades after `inactivity_days` (per-repo override, else the
global `DEFAULT_INACTIVITY_DAYS`). Degraded repos land in **Look again**; from a
card there you can hit **"I looked — keep priority"** to reset the timer without
re-triaging, or drag it to a new column.

## Data & persistence
SQLite lives in `./data/dashboard.db` (mounted as `/data` in the container), so
your triage survives rebuilds. Only triage state is stored locally; the repo
list is never cached to disk.

## Local development (without Docker)
```bash
# terminal 1 — backend on :8787
cd server && npm install && GITHUB_TOKEN=ghp_... npm run dev

# terminal 2 — frontend on :5173 (proxies /api to :8787)
cd client && npm install && npm run dev
```

## Layout
```
server/   Express API + SQLite + GitHub fetch
client/   Vite + React + Tailwind UI
Dockerfile / docker-compose.yml
```

## API
| Method | Route | Purpose |
| --- | --- | --- |
| GET  | `/api/repos` | repos + computed columns/countdowns |
| POST | `/api/refresh` | re-fetch from GitHub |
| POST | `/api/repos/:id/priority` | `{ priority: 1\|2\|3\|null }` (resets timer) |
| POST | `/api/repos/:id/touch` | "I looked" — reset timer, keep priority |
| POST | `/api/repos/:id/inactivity` | `{ days: number\|null }` per-repo override |
| POST | `/api/reorder` | `{ orderedIds: [...] }` save sort order |
