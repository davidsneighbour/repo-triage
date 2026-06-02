## Issues

* [ ] when loading the page the first time show cached data immediately, then update when the API call returns
* [ ] add Lucide icons for better visuals
* [ ] add a help menu with F1 and connect with a Markdown file to show usage instructions. Make the display Mermaid enabled for diagrams and add initial help content.
* [ ] find out and explicitly document what happens when we set a reminder duration larger than 7 days for any item. where is it shown? when will it decay? etc.

## Prioritized next steps

### P0 - Testing foundation (start here)

* [x] replace root `test` script placeholder with workspace test orchestration (`npm run test:client`, `npm run test:server`)
* [x] add Vitest to `client/` with jsdom + React Testing Library setup
* [x] add Vitest to `server/` for pure logic and API behavior tests
* [x] extract and export testable pure functions from runtime files:
	* [x] `effectiveState()` and day-column helpers from `server/index.js` into `server/schedule.js`
	* [x] `timeAgo()`, `calendarLabel()`, and filter/day grouping helpers from `client/src/App.jsx` into `client/src/lib/*.js`
	* [x] rate-limit header parsing and mapping helpers from `server/github.js` into exportable utility functions
* [x] add CI-local command path: `npm run test` must run all unit tests without Docker

### P1 - Cover current issue list with tests and docs

* [x] for "show cached data immediately, then update":
	* [x] define expected behavior in README + todo acceptance criteria
	* [x] add integration-level client test proving stale/cache payload is rendered first and refreshed payload replaces it
* [x] for "add Lucide icons":
	* [x] add dependency and icon map plan (header status, card actions, filters)
	* [x] add snapshot/DOM tests for icon presence and accessible labels
* [ ] for "help menu with F1 + markdown + Mermaid":
	* [ ] define keyboard shortcut contract (`F1` opens help, `Esc` closes)
	* [ ] define markdown rendering and Mermaid initialization boundaries
	* [ ] add tests for open/close behavior and fallback when Mermaid parsing fails
* [ ] for "reminder duration larger than 7 days":
	* [ ] document exact behavior of `effectiveState` and board clamping
	* [ ] add server unit tests for inactivity values `0`, `1`, `7`, `14`, `null`

### P2 - Stability and regression protection

* [ ] add API contract tests for all routes in `server/index.js` with valid + invalid payloads
* [ ] add client API wrapper tests in `client/src/api.js` to verify method, path, and request body shape
* [ ] add drag/drop behavior tests around `onDropColumn` and `onDropOnCard`
* [ ] add localStorage filter persistence tests for migration and default fallback
* [ ] add rate-limit/auth error rendering tests for all banner branches

## Automatic unit testing path (Vitest)

### Phase 1 - Tooling

* [x] `client/`: install `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
* [x] `server/`: install `vitest` (and `supertest` if API route tests are added without full server boot)
* [x] add scripts:
	* [x] `client/package.json`: `test`, `test:watch`, `test:coverage`
	* [x] `server/package.json`: `test`, `test:watch`, `test:coverage`
	* [x] root `package.json`: `test`, `test:client`, `test:server`

### Phase 2 - First passing suite

* [x] client unit tests:
	* [x] `timeAgo` formatting boundaries
	* [x] `calendarLabel` for offset `0/1/2/n`
	* [x] filter union logic (`own`, `forks`, `archived`) and search term matching
	* [x] `dayColumns` generation from `defaultInactivityDays`
* [x] server unit tests:
	* [x] `effectiveState` for never checked, due, and future buckets
	* [x] rate-limit parsing from synthetic response headers
	* [ ] inactivity override behavior vs global default

### Phase 3 - Behavior tests

* [ ] client behavior tests:
	* [ ] loading states (`loading...`, `fetching repositories...`)
	* [ ] menu actions call correct API wrappers
	* [ ] sync button disabled on auth invalid / rate limit exhausted
* [ ] server route tests:
	* [ ] `POST /api/repos/:id/check` rejects negative days
	* [ ] `POST /api/repos/:id/inactivity` rejects invalid values
	* [ ] `POST /api/repos/:id/priority` rejects invalid priority
	* [ ] `GET /api/repos` returns expected metadata keys

### Phase 4 - Definition of done

* [x] all tests runnable via `npm run test` from repo root
* [ ] coverage report generated for `client/` and `server/`
* [ ] minimum baseline coverage target set (start at 60%, raise over time)

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

## Notes for implementation sequence

* [ ] do P0 before feature/UI work so new behavior ships with tests
* [ ] implement one issue at a time and add matching tests before moving on
* [ ] update README testing section after Vitest path is in place
