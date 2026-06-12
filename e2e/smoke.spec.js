/**
 * Smoke tests: full browser flow against the built client with all /api/*
 * routes intercepted by Playwright. No backend server or GitHub token needed.
 *
 * Covered flows (per issue #12):
 *   - board loads with correct columns and repo cards
 *   - drag a card to a different column (card-on-card drop)
 *   - add a notice via the card settings menu
 *   - reload and confirm state persists (mock state updated by mutations)
 *   - toggle between board and list view
 *   - bulk-select + ignore + undo toast
 */

import { test, expect } from '@playwright/test';

const DEFAULT_INACTIVITY = 3;

function makeRepos() {
  return [
    {
      id: 1,
      name: 'alpha-repo',
      full_name: 'user/alpha-repo',
      html_url: 'https://github.com/user/alpha-repo',
      description: 'Alpha test repo',
      private: false,
      archived: false,
      fork: false,
      language: 'JavaScript',
      pushed_at: '2026-01-01T00:00:00.000Z',
      owner: 'user',
      checkedAgeDays: 3,
      dueInDays: 0,
      needsCheckToday: true,
      column: 'day-0',
      boardOffset: 0,
      position: 0,
      inactivity_days: null,
      effective_inactivity_days: DEFAULT_INACTIVITY,
      priority: null,
      priority_set_at: null,
      tags: [],
      ignored: false,
      notice_count: 0,
      latest_notice: null,
      stargazers_count: 5,
      open_issues_count: 0,
      forks_count: 0,
    },
    {
      id: 2,
      name: 'beta-repo',
      full_name: 'user/beta-repo',
      html_url: 'https://github.com/user/beta-repo',
      description: 'Beta test repo',
      private: false,
      archived: false,
      fork: false,
      language: 'Python',
      pushed_at: '2026-01-02T00:00:00.000Z',
      owner: 'user',
      checkedAgeDays: 1,
      dueInDays: 2,
      needsCheckToday: false,
      column: 'day-1',
      boardOffset: 1,
      position: 0,
      inactivity_days: null,
      effective_inactivity_days: DEFAULT_INACTIVITY,
      priority: null,
      priority_set_at: null,
      tags: [],
      ignored: false,
      notice_count: 0,
      latest_notice: null,
      stargazers_count: 0,
      open_issues_count: 2,
      forks_count: 0,
    },
    {
      id: 3,
      name: 'gamma-repo',
      full_name: 'user/gamma-repo',
      html_url: 'https://github.com/user/gamma-repo',
      description: 'Gamma test repo',
      private: false,
      archived: false,
      fork: false,
      language: 'Go',
      pushed_at: '2026-01-03T00:00:00.000Z',
      owner: 'user',
      checkedAgeDays: 0,
      dueInDays: 1,
      needsCheckToday: false,
      column: 'day-2',
      boardOffset: 2,
      position: 0,
      inactivity_days: null,
      effective_inactivity_days: DEFAULT_INACTIVITY,
      priority: null,
      priority_set_at: null,
      tags: [],
      ignored: false,
      notice_count: 0,
      latest_notice: null,
      stargazers_count: 10,
      open_issues_count: 0,
      forks_count: 1,
    },
  ];
}

function apiPayload(repos) {
  return {
    repos,
    cacheReady: true,
    defaultInactivityDays: DEFAULT_INACTIVITY,
    dayRolloverHour: 4,
    lastFetch: '2026-06-12T10:00:00.000Z',
    username: 'user',
    tokenPresent: true,
    lastError: null,
    syncing: false,
    rateLimit: { remaining: 4500, limit: 5000, used: 500, reset: null, authInvalid: false, lastChecked: null },
    sourceStatus: { owners: [{ owner: 'user', count: 3, scope: 'self' }], warnings: [] },
    authStatus: { source: 'env', present: true },
  };
}

/**
 * Register mocked /api/* routes on the page and return the live state object.
 * Mutations (check, ignore, notices) update state in-place so that subsequent
 * GET /api/repos calls return the updated data — simulating persistence.
 */
async function mockApi(page) {
  const state = {
    repos: makeRepos(),
    notices: {},       // repoId (number) → notice[]
    nextNoticeId: 1,
  };

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    const ok = (data = { ok: true }) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

    // GET /api/repos
    if (method === 'GET' && path === '/api/repos') {
      return ok(apiPayload(state.repos));
    }

    // POST /api/refresh
    if (method === 'POST' && path === '/api/refresh') {
      return ok({ ok: true, queued: false, syncing: false, cacheReady: true, lastFetch: '2026-06-12T10:00:00.000Z' });
    }

    // POST /api/reorder
    if (method === 'POST' && path === '/api/reorder') return ok();

    // GET /api/notices (all-repo notices dialog)
    if (method === 'GET' && path === '/api/notices') {
      return ok(Object.values(state.notices).flat());
    }

    // GET /api/reports
    if (method === 'GET' && path === '/api/reports') return ok([]);

    // Per-repo routes /api/repos/:id/...
    const m = path.match(/^\/api\/repos\/(\d+)\/(.+)$/);
    if (m) {
      const id = parseInt(m[1], 10);
      const action = m[2];
      const repo = state.repos.find((r) => r.id === id);

      if (action === 'check' && method === 'POST') {
        const body = route.request().postDataJSON();
        const daysAgo = body?.daysAgo ?? 0;
        if (repo) {
          const offset = Math.min(Math.max(0, DEFAULT_INACTIVITY - daysAgo), DEFAULT_INACTIVITY - 1);
          repo.column = `day-${offset}`;
          repo.boardOffset = offset;
          repo.checkedAgeDays = daysAgo;
          repo.dueInDays = Math.max(0, DEFAULT_INACTIVITY - daysAgo);
          repo.needsCheckToday = daysAgo >= DEFAULT_INACTIVITY;
        }
        return ok();
      }

      if (action === 'ignore' && method === 'POST') {
        const body = route.request().postDataJSON();
        if (repo) repo.ignored = body?.ignored ?? false;
        return ok();
      }

      if (action === 'notices') {
        if (method === 'POST') {
          const body = route.request().postDataJSON();
          const notice = {
            id: state.nextNoticeId++,
            repo_id: id,
            full_name: repo?.full_name ?? '',
            body: body.body,
            created_at: new Date().toISOString(),
          };
          if (!state.notices[id]) state.notices[id] = [];
          state.notices[id].push(notice);
          if (repo) {
            repo.notice_count = (repo.notice_count || 0) + 1;
            repo.latest_notice = { body: notice.body, created_at: notice.created_at };
          }
          return ok();
        }
        if (method === 'GET') {
          return ok(state.notices[id] || []);
        }
      }

      if (action === 'priority' && method === 'POST') {
        const body = route.request().postDataJSON();
        if (repo) repo.priority = body?.priority ?? null;
        return ok();
      }

      if (action === 'clear' && method === 'POST') {
        if (repo) { repo.column = 'day-0'; repo.boardOffset = 0; repo.needsCheckToday = true; }
        return ok();
      }

      if (action === 'touch' && method === 'POST') {
        if (repo) {
          repo.column = `day-${DEFAULT_INACTIVITY - 1}`;
          repo.boardOffset = DEFAULT_INACTIVITY - 1;
          repo.checkedAgeDays = 0;
          repo.dueInDays = DEFAULT_INACTIVITY;
          repo.needsCheckToday = false;
        }
        return ok();
      }

      if (action === 'inactivity' && method === 'POST') return ok();
      if (action === 'tags' || action.startsWith('tags/')) return ok([]);
    }

    // Per-notice delete: /api/notices/:id
    if (method === 'DELETE' && path.match(/^\/api\/notices\/\d+$/)) return ok();

    // Tag delete: /api/tags/:tag
    if (method === 'DELETE' && path.match(/^\/api\/tags\//)) return ok();

    route.fulfill({ status: 404, body: 'Not found in mock' });
  });

  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('smoke', () => {
  test('board loads with correct columns and repo cards', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // All three day columns are present
    await expect(page.getByRole('group', { name: /Today column/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /Tomorrow column/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /Day after column/ })).toBeVisible();

    // All three repo cards are visible
    await expect(page.getByRole('group', { name: /alpha-repo/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /beta-repo/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /gamma-repo/ })).toBeVisible();
  });

  test('drag card onto another card moves it to the same column', async ({ page }) => {
    const state = await mockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // gamma-repo (day-2) dragged onto alpha-repo (day-0) → gamma-repo lands in Today
    await page.dragAndDrop(
      '[role="group"][aria-label*="gamma-repo"]',
      '[role="group"][aria-label*="alpha-repo"]',
    );
    await page.waitForLoadState('networkidle');

    // Mock state updated
    const gamma = state.repos.find((r) => r.id === 3);
    expect(gamma.column).toBe('day-0');

    // Reload — GET /api/repos returns updated state
    await page.reload();
    await page.waitForLoadState('networkidle');

    const todayColumn = page.getByRole('group', { name: /Today column/ });
    await expect(todayColumn.getByRole('group', { name: /gamma-repo/ })).toBeVisible();
  });

  test('search filter hides non-matching cards and clears', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // All three cards visible initially
    await expect(page.getByRole('group', { name: /alpha-repo/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /beta-repo/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /gamma-repo/ })).toBeVisible();

    // Type a search term that only matches alpha-repo
    await page.getByLabel('Search repositories').fill('alpha');

    // Only alpha-repo visible, others hidden
    await expect(page.getByRole('group', { name: /alpha-repo/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /beta-repo/ })).not.toBeVisible();
    await expect(page.getByRole('group', { name: /gamma-repo/ })).not.toBeVisible();

    // Clear search — all cards return
    await page.getByLabel('Search repositories').clear();
    await expect(page.getByRole('group', { name: /beta-repo/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /gamma-repo/ })).toBeVisible();
  });

  test('adds a notice via card settings menu', async ({ page }) => {
    const state = await mockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open settings menu for beta-repo
    await page
      .getByRole('group', { name: /beta-repo/ })
      .getByRole('button', { name: 'Open repository settings' })
      .click();

    // Fill in the notice textarea and submit.  Scope to the dialog so
    // 'Add' doesn't collide with the 'Add tag to …' buttons on cards.
    const menu = page.getByRole('dialog', { name: /Settings for beta-repo/ });
    await menu.getByRole('textbox', { name: 'New notice' }).fill('Test notice text');
    await menu.getByRole('button', { name: 'Add', exact: true }).click();

    await page.waitForLoadState('networkidle');

    // Notice was persisted in mock state
    expect(state.notices[2]).toHaveLength(1);
    expect(state.notices[2][0].body).toBe('Test notice text');
  });

  test('switches between board and list view', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Board view: Today column visible
    await expect(page.getByRole('group', { name: /Today column/ })).toBeVisible();

    // Switch to list view
    await page.getByRole('button', { name: 'Switch to list view' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('group', { name: /Today column/ })).not.toBeVisible();

    // Switch back to board view
    await page.getByRole('button', { name: 'Switch to board view' }).click();
    await expect(page.getByRole('group', { name: /Today column/ })).toBeVisible();
    await expect(page.getByRole('table')).not.toBeVisible();
  });

  test('bulk ignore shows undo toast; undo restores the repo', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Select alpha-repo via its checkbox
    await page.getByRole('checkbox', { name: 'Select alpha-repo' }).check();
    await expect(page.getByRole('region', { name: 'Bulk actions' })).toBeVisible();

    // Bulk-ignore — exact:true so 'Unignore' (substring 'Ignore') doesn't match
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Ignore', exact: true })
      .click();
    await page.waitForLoadState('networkidle');

    // Toast appears with an Undo button
    const toast = page.getByRole('status').filter({ hasText: /ignored/i });
    await expect(toast).toBeVisible();
    const undoBtn = page.getByRole('button', { name: 'Undo' });
    await expect(undoBtn).toBeVisible();

    // Click Undo — repo is unignored and reappears
    await undoBtn.click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('group', { name: /alpha-repo/ })).toBeVisible();
  });
});
