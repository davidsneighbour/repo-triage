# Repo·triage — roadmap & TODO

*Updated 2026-06-03. Completed work lives in git history; this file tracks only
what's next.*

## Manual additions

* [x] `npm test` printed a Vite `esbuild`/`oxc` deprecation warning — root cause
  was an old toolchain (Vite 5 + `@vitejs/plugin-react` 4 against vitest's bundled
  Rolldown Vite 8). **Properly fixed** by the dependency upgrade below: Vite 8 +
  `@vitejs/plugin-react` 6 (Rolldown-native) + React 19 + Express 5. The temporary
  `customLogger` filter is gone; output is clean.
* [x] open PRs cleared. The only one (Dependabot: bump Vite 5.4.21→8.0.16) was
  superseded by the manual Vite 8 upgrade already on `main`, so it couldn't merge
  (lockfile conflict) and was closed as obsolete. No open PRs remain.
* [x] server + CLI coverage were red against the raised 90/85/85/90 floors (a
  pre-existing gap since the threshold bump). Restored to green with real tests
  (report kinds + sparse data, GitHub owner/membership edge paths, cold-cache
  board, CLI priority/clear paths) and `/* v8 ignore */` on bootstrap-only code;
  `db.js` (pure DDL) excluded from measurement. `npm run test:coverage` passes.
* [x] adding tags via interface is impossible or not easily found — each card
  now carries an always-visible dashed "＋ tag" chip (even when untagged) that
  opens the CardMenu focused on the tag input. No more hunting in the gear menu.
* [x] add a filter option (independent of others) for repo priority (1-2) —
  repurposed the vestigial `priority` column as a real, independent triage
  priority (P1/P2/P3). Set it from the CardMenu or `repo-triage priority`; a
  coloured chip shows on cards; a toolbar "priority" popover filters by level
  (composes with every other filter). Decoupled from the check/schedule flow.
* [ ] write an extensive documentation that can be loaded via F1 and a direct link in the UI, describing all features and how to use them (including the CLI companion app once it's implemented). Use Markdown format and include screenshots where helpful.

## Snapshot (current state)

Local-only day-schedule kanban for triaging GitHub repositories.

* **Stack:** Express + SQLite (`server/`), React + Tailwind v4 (`client/`), Vitest
  both sides. Backend owns GitHub fetching; frontend only reads `/api/repos`.
* **Implemented:** day-column board with drag-drop scheduling, per-repo review
  cycle, honest `checked_at`, inclusive filters (own/forks/archived) + per-column
  filter, ignore flag, timestamped notices, multi-owner loading
  (`GITHUB_OWNERS`, users + orgs, public fallback + warnings), owner badges,
  background sync, rate-limit/auth feedback, localStorage cache, F1 help.
* **Tests:** client 14 files / 53, server 4 files / 54 — all green; coverage
  thresholds enforced in each `vitest.config.js`.

## Working agreements

* `DESIGN.md` is the binding UI contract — update it before changing `client/`.
* Add/adjust tests alongside behaviour; keep both suites green and coverage above
  the configured floors. No TypeScript; Tailwind classes stay static strings.
* **`gh`-first:** for anything touching GitHub, prefer the `gh` CLI
  (`gh auth token`, `gh api`, `gh repo`) over hand-rolled REST + PAT plumbing.

## Known gaps / loose ends

* [x] `README.md` refreshed (owners, tags, notices, ignore, reports, CLI, gh
  auth, prebuilt help SVG, accessibility, Vite 8 / React 19 / Express 5 stack).
* [x] `repo_state.priority` (1–3) was vestigial — **decided: repurposed as a
  real, independent triage priority** (set via CardMenu / `priority` CLI / the
  `/priority` route; filtered in UI + CLI; decoupled from check via new `/clear`).
* [ ] `App.jsx` is one ~1.3k-line file — extract components (Board, Column, Card,
  dialogs) as features land.

---

## Roadmap

Priority key: **(P0)** next / quick win · **(P1)** soon · **(P2)** later.

### 1. GitHub via the `gh` CLI (foundational)

* [x] **(P0)** Auth via `gh`: if `GITHUB_TOKEN` is unset, fall back to
  `gh auth token` so users who already `gh auth login` need no PAT. Surface which
  auth source is active in `/api/repos` (`authSource: env|gh|null`).
* [ ] **(P1)** Fetch through `gh api --paginate` (with REST fetch as fallback) to
  drop custom pagination and inherit `gh`'s auth, retry, and rate-limit handling.
* [ ] **(P1)** Enrich repo metadata cheaply via `gh api`/GraphQL: open-PR count,
  open-issue count, default branch, latest release, topics, CI status of default
  branch, last-commit author/date.
* [ ] **(P2)** Per-card `gh` quick actions: open in browser (`gh repo view --web`),
  list PRs/issues, create an issue — shelled out server-side, confirmed in UI.
* [ ] **(P2)** Map GitHub repo **topics** → suggested tags (see Tags).

### 2. Tags & flags

* [x] **(P0)** `repo_tag` table (repo_id, tag, created_at) + API:
  `GET/POST/DELETE /api/repos/:id/tags`, `GET /api/tags` (distinct + counts).
  Tags normalised (trim/lower/cap), deduped; per-repo `tags[]` on the payload.
* [x] **(P1)** Tag chips on cards (deterministic colour, like owner palette) and a
  tag filter in the toolbar (multi-select, AND/OR).
* [x] **(P1)** Manage tags in the card menu (add/remove with autocomplete from
  existing tags); documented in `DESIGN.md`.
* [ ] **(P2)** Bulk tag/untag via multi-select (see Usability).
* [ ] **(P2)** Generic per-repo flags beyond `ignored` (e.g. `pinned`, `muted`,
  `needs-decision`) — a small extensible flag set rather than one column each.

### 3. CLI companion app

A Node CLI (`bin/repo-triage`) that drives the same SQLite state as the web app,
so flags/tags/notices can be scripted. `gh`-aware for GitHub-side actions.

* [x] **(P1)** Scaffolding: `repo-triage <command>` in `cli/`, talks to the local
  API, `--json` output for piping, `--api`/`REPO_TRIAGE_API` override. (Direct-DB
  fallback dropped: the repo catalogue lives in server memory, not SQLite.)
* [x] **(P1)** `list` with filters (owner, tag, language, due, ignored/all) + `--json`.
* [x] **(P1)** Set flags: `ignore`/`unignore`, `check [--days N]`, `clear`,
  `interval <days|default>`, `tag add|rm <repo> <tag…>`, `note add <repo> "…"`.
* [ ] **(P2)** Resolve repos by `owner/name` or fuzzy match; act on many at once
  (`--all-matching`, stdin list).
* [ ] **(P2)** `gh` passthrough helpers (e.g. `repo-triage open <repo>` →
  `gh repo view --web`); reuse `gh auth token`.
* [ ] **(P2)** Ship as an `npm` bin + document; optional `gh` extension wrapper
  (`gh triage …`) for discoverability.

### 4. Reports & exports

* [x] **(P1)** Report builder (server, `report.js`): summary, due, never-reviewed,
  stale (`?days=`), per-owner, language distribution, archived, open-issues/PRs.
* [x] **(P1)** `GET /api/reports/:kind?format=json|md|csv`; shared by the UI
  Reports dialog and the `repo-triage report <kind>` CLI command.
* [ ] **(P2)** Exportable Markdown digest ("weekly triage") suitable for pasting
  into an issue/PR; optional scheduled write to a file.
* [ ] **(P2)** Backup/restore: export all local triage state (flags, intervals,
  notices, tags) to JSON and re-import.

### 5. Display & board options

* [x] **(P0)** Show fetched-but-hidden data on cards: ⭐ stars and open-issue count
  (compact, muted; never as accent colour).
* [x] **(P0)** "×" to clear a column's filter field (carried over idea).
* [ ] **(P1)** Group-by selector: by **day** (current), **owner**, **tag**, or
  **language**; board re-columns accordingly.
* [x] **(P1)** Card **density** toggle (compact/comfortable), persisted — compact
  uses `p-2`, `line-clamp-1` descriptions, and hides the notice preview.
* [ ] **(P1)** Per-column sort (name, pushed, stars, due).
* [ ] **(P1)** List/table view as an alternative to the board (sortable columns,
  good for bulk scanning and reports).
* [ ] **(P2)** Field visibility toggles (stars, issues, language, pushed, notice
  preview) so users tune information density.

### 6. Accessibility

* [x] **(P0)** Keyboard scheduling: `[` / `]` reschedule the focused card one
  column toward Today / further out (no drag needed); `aria-keyshortcuts` + help.
* [x] **(P0)** Dialog/popover focus management: focus trap, restore focus on close,
  `aria-modal`, labelled headings — shared `useDialog` hook on Help, Notices,
  Reports, Card menu, and the Tag filter.
* [x] **(P1)** Semantic roles/labels for board, columns, cards; a polite live
  region announcing sync status and action results.
* [x] **(P1)** Respect `prefers-reduced-motion` (sync spinner, transitions).
* [x] **(P1)** Verify contrast of the phosphor-green neutral ramp (esp. muted text
  and placeholders) against WCAG AA; adjust shades if needed.
* [ ] **(P2)** Add an automated a11y check (axe) to the component test setup.

### 7. Usability & polish

* [ ] **(P1)** Multi-select cards → bulk ignore / tag / schedule.
* [ ] **(P1)** Undo (toast with "undo") for destructive actions: delete notice,
  clear check, bulk ops.
* [ ] **(P1)** Confirm before destructive actions (delete notice / bulk clear).
* [ ] **(P2)** Toast/notification system for action feedback.
* [ ] **(P2)** Persist view/display prefs server-side so web + CLI agree.
* [ ] **(P2)** Settings panel (review cycle, sync interval, owners) editable in-app
  instead of `.env`-only.

### 8. Quality & infra

* [ ] **(P1)** Refresh `README.md` + reconcile with `DESIGN.md` and `AGENTS.md`.
* [ ] **(P1)** GitHub Actions CI: run `npm test` + markdown lint on PRs.
* [ ] **(P2)** Health/version endpoint (`/api/health`) for Docker/monitoring.
* [ ] **(P2)** Split `App.jsx` into components (Board, Column, Card, CardMenu,
  dialogs) once tag/report UI lands.
* [ ] **(P2)** E2E smoke test (Playwright): load → drag a card → add note → reload.

---

## Suggested next steps (summary)

1. **`gh` auth fallback (1·P0)** — let users skip the PAT by reusing
   `gh auth token`. Smallest change with the biggest onboarding win, and sets up
   `gh api` data enrichment.
2. **Surface stars + open issues on cards, and add the column-filter "×" (5·P0)**
   — pure display wins from data already in hand.
3. **Tags system (2·P0)** — DB + API + card chips + filter. It's the backbone the
   CLI and reports build on; also resolves the vestigial `priority` field.
4. **CLI companion (3·P1)** — `repo-triage` for `ignore`/`check`/`tag`/`note`,
   `--json` output, `gh`-aware. Makes flags/tags scriptable as requested.
5. **Reports (4·P1)** — overdue / stale / never-reviewed / per-owner, exportable
   to Markdown/CSV, shared by a UI dialog and `repo-triage report`.
6. **Accessibility pass (6·P0–P1)** — keyboard scheduling, dialog focus traps,
   reduced-motion, contrast check on the new green theme.
7. **Docs refresh (8·P1)** — bring `README.md` back in line with reality.

Then iterate on richer `gh api` metadata, group-by/list views, and bulk actions.

## Manual smoke test (pre-release)

Most behaviour is covered by automated tests; spot-check the parts that need a
real browser + token:

* [ ] First load shows cached board (if any) then refreshes; slow startup polls in.
* [ ] Drag across columns persists after reload; "checked today" shows on snooze.
* [ ] Multi-owner load: owner badges appear; non-member org shows the public-only
  warning banner.
* [ ] Auth-invalid and rate-limit-exhausted banners render and disable sync.
