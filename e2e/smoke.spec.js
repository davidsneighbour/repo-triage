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
import { mockApi } from './helpers.js';

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
