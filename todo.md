# Repo·triage — roadmap & TODO

*Updated 2026-06-03. Completed work lives in git history; this file tracks only
what's next.*

## Manual additions

* [x] checked the project for deprecations. Findings:
  * **Transitive (no action available):** `prebuild-install@7.1.3` is marked
    "no longer maintained", but it's pulled in by `better-sqlite3@12.10.0` (the
    latest), which still depends on it. We can't replace it without an upstream
    change — tracked, not a deprecation we introduce.
  * **Breaking change for manual check:** `GITHUB_USERNAME` is our own
    documented deprecated alias for `GITHUB_OWNERS` (read only as a fallback).
    Internal usage is already on `GITHUB_OWNERS`; removing the alias entirely is
    a user-facing breaking change (existing `.env` files), so it's deferred to a
    future major rather than removed now. **Decision needed:** drop it in vNext?

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

* [x] `App.jsx` was one ~1.8k-line file — split into a container (`App.jsx`,
  ~600 lines) plus one component per file under `components/` (Column, RepoCard,
  CardMenu, Badge, Help/Notices/Reports dialogs, Tag/Priority/Fields menus) with
  shared bits in `lib/constants.js` + `lib/boardCache.js`. All tests unchanged
  and green.

## Roadmap

Priority key: **(P0)** next / quick win · **(P1)** soon · **(P2)** later.

### 1. GitHub via the `gh` CLI (foundational)

* [ ] **(P1)** Fetch through `gh api --paginate` (with REST fetch as fallback) to
  drop custom pagination and inherit `gh`'s auth, retry, and rate-limit handling.
  **Deliberately deferred** (not overlooked): auth already falls back to
  `gh auth token`, so this only changes the *transport*. Doing it well means
  re-routing the most intricate, security-sensitive code (`fetchOwnerRepos`
  org-membership detection, 403→public fallbacks, rate-limit/`x-ratelimit-*`
  parsing — all keyed on HTTP status/headers that `gh api` doesn't surface the
  same way) and is high-risk for repo loading. Worth its own focused pass with
  the existing `github.fetch.test.js` matrix kept green, not a rushed change.
* [x] **(P1)** Enrich repo metadata — added the fields that ship **free** in the
  REST repos-list response (no extra calls): `forks_count`, `default_branch`,
  `topics`, `license`. Forks now show as a card stat + sortable list column
  (toggle via the fields menu); branch/topics/license ride on the payload for
  future use (topics→tags is its own P2). **Deferred (needs per-repo `gh api`/
  GraphQL):** distinct open-PR count, latest release, CI status, last-commit
  author/date.
* [ ] **(P2)** Per-card `gh` quick actions: open in browser (`gh repo view --web`),
  list PRs/issues, create an issue — shelled out server-side, confirmed in UI.
* [ ] **(P2)** Map GitHub repo **topics** → suggested tags (see Tags).

### 2. Tags & flags

* [ ] **(P2)** Bulk tag/untag via multi-select (see Usability).
* [ ] **(P2)** Generic per-repo flags beyond `ignored` (e.g. `pinned`, `muted`,
  `needs-decision`) — a small extensible flag set rather than one column each.

### 3. CLI companion app

A Node CLI (`bin/repo-triage`) that drives the same SQLite state as the web app,
so flags/tags/notices can be scripted. `gh`-aware for GitHub-side actions.

* [ ] **(P2)** Resolve repos by `owner/name` or fuzzy match; act on many at once
  (`--all-matching`, stdin list).
* [ ] **(P2)** `gh` passthrough helpers (e.g. `repo-triage open <repo>` →
  `gh repo view --web`); reuse `gh auth token`.
* [ ] **(P2)** Ship as an `npm` bin + document; optional `gh` extension wrapper
  (`gh triage …`) for discoverability.

### 4. Reports & exports

* [ ] **(P2)** Exportable Markdown digest ("weekly triage") suitable for pasting
  into an issue/PR; optional scheduled write to a file.

### 5. Display & board options

* [x] **(P1)** List/table view — a board/list toolbar toggle swaps the columns
  for a single sortable `ListView` table (click-to-sort columns, per-row gear
  reuses `CardMenu`, field toggles hide columns). Persisted; pure sort helper
  `sortReposForList` in `board.js`.

### 6. Accessibility

* [ ] **(P2)** Add an automated a11y check (axe) to the component test setup.

### 7. Usability & polish

* [x] **(P1)** Multi-select cards → bulk actions — a selection checkbox on every
  card and list row reveals a `BulkBar` (Checked now / Move to Today / Clear /
  Ignore / Unignore / tag) that loops the existing single-repo endpoints over the
  whole selection, then clears + refreshes. Selection is pruned when a repo
  disappears after a sync.
* [x] **(P1)** Undo toast — a reusable `Toast` with an **Undo** action now backs
  **ignore** (single via CardMenu + bulk), where undo is exact (unignore). Toast
  auto-dismisses (~6s) + manual close. Faithful undo for delete-notice and
  clear-check needs server-side restore (re-adding a notice loses its timestamp;
  a cleared schedule can't be reconstructed), so it's split into the P2 below
  rather than shipping a lossy undo.
* [ ] **(P2)** Server-side restore so undo can cover notice-deletion (preserve
  `created_at`) and clear-check (snapshot the prior anchor/`checked_at`).
* [ ] **(P2)** Toast/notification system for action feedback.
* [ ] **(P2)** Persist view/display prefs server-side so web + CLI agree.
* [ ] **(P2)** Settings panel (review cycle, sync interval, owners) editable in-app
  instead of `.env`-only.

### 8. Quality & infra

* [x] **(P1)** Reconciled `AGENTS.md` with reality (it claimed "no tests exist",
  a single `repo_state` table, `effectiveState` in `index.js`, and App.jsx as the
  "entire UI" — all now corrected: enforced Vitest suites, three tables,
  `schedule.js`, the component split, `gh`-token fallback, `GITHUB_OWNERS`).
  `README.md` was already current; markdown-lint + cspell clean.
* [x] **(P2)** Split `App.jsx` into components (Column, RepoCard, CardMenu,
  Badge, dialogs, toolbar menus) — done; see Known gaps above.
* [ ] **(P2)** E2E smoke test (Playwright): load → drag a card → add note → reload.

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
