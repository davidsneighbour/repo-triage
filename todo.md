# Project status dashboard - TODO and testing plan

## Status snapshot (2026-06-03)

* `npm run test` runs **client (10 files / 30 tests)** + **server (4 files / 33 tests)**, all green, no Docker.
* `npm run test:coverage` runs both workspaces with enforced thresholds (`vitest.config.js`). Current: **client ~90% lines / 83% branch**, **server ~87% lines / 78% branch**.
* No-Docker run path: `npm run dev` (root) boots backend + frontend together; the backend auto-loads the root `.env`. `npm run server` runs just the backend.
* **The engineering backlog is clear.** All testing-foundation, issue-coverage, route-test, coverage-enforcement, and docs work is complete and committed. The only remaining items are the manual release-QA checklist below (requires a browser + a real `GITHUB_TOKEN`); most of those behaviors are already covered by automated tests.

## Manual interaction test checklist

Run this checklist against local dev (`server :8787`, `client :5173`) and Docker (`:8787`).

### Startup and data loading

* [ ] first load shows loading state, then board appears once `cacheReady` is true
* [ ] if startup sync is slow, polling refreshes board automatically every ~2s until ready
* [ ] repo count and review cycle value in header match API payload

### Header and sync controls

* [ ] `sync GitHub` triggers refresh and toggles `syncing...` label while in flight
* [ ] sync button disabled when `rateLimit.authInvalid` is true
* [ ] sync button disabled when `rateLimit.remaining === 0`
* [ ] rate-limit indicator text changes style for normal, low (<100), and zero
* [ ] last synced timestamp updates after manual refresh

### Search and filter interaction

* [ ] typing in `filter repos...` narrows cards by name, description, and language
* [ ] toggling `own` only shows non-fork, non-archived repos
* [ ] toggling `forks` includes fork repos regardless of archive state
* [ ] toggling `archived` includes archived repos regardless of fork state
* [ ] filter behavior is inclusive union across checked toggles
* [ ] `show all` appears when not all toggles are enabled and restores defaults
* [ ] filter settings persist after page reload (localStorage)

### Board and drag-drop interaction

* [ ] Today column remains sticky while horizontally scrolling future columns
* [ ] dragging card to empty column moves it and persists after reload
* [ ] dropping card onto another card updates moved card column correctly
* [ ] empty-column `drag here` placeholder appears only when no cards exist

### Card menu actions

* [ ] `...` opens card menu and clicking backdrop closes it
* [ ] `Checked now` sets check date to now and moves repo to furthest future bucket
* [ ] `Move to Today` uses default inactivity days target and moves repo to today bucket
* [ ] `Clear check date` sets repo back to "not checked yet"
* [ ] setting `Review every (days)` to a number persists per-repo override
* [ ] leaving `Review every (days)` blank resets to default cycle

### Error and edge-state handling

* [ ] invalid token banner appears when backend reports `authInvalid`
* [ ] rate-limit exhausted banner appears with reset time when remaining is zero
* [ ] generic GitHub error banner appears for other failures
* [ ] missing token hint appears when `tokenPresent` is false
* [ ] app remains usable for local filtering/search even when refresh is blocked

### Schedule edge cases

* [ ] never-checked repos always resolve to Today
* [ ] repos checked >= inactivity threshold resolve to Today
* [ ] repos checked below threshold resolve to future day columns
* [ ] per-repo inactivity values greater than global default are documented and verified

### Links and metadata

* [ ] clicking repo name opens GitHub page in new tab
* [ ] card badges correctly show public/private, live/archived, fork, language
* [ ] checked age and due text render expected values after mutations

## Notes

* Implement one item at a time and add matching tests before moving on.
