/**
 * Mobile viewport smoke tests (issue #19).
 *
 * Verifies the responsive mobile layout (≤ 640 px) via a real Chromium browser:
 *   - single-column MobileBoard + DayPicker chrome
 *   - day switching via DayPicker
 *   - long-press on a card opens the MoveSheet
 *   - MoveSheet: preset click, "Mark done" submit
 *   - "filters" button opens the MobileActionSheet
 *   - touch-target height ≥ 44 px on key interactive elements
 *
 * All /api/* routes are intercepted — no backend server needed.
 */

import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers.js";

// Pixel 5-style viewport: 390 × 844 with touch enabled.
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

// LONG_PRESS_MS in RepoCard is 450 ms; hold 100 ms longer to be safe.
const LONG_PRESS_HOLD_MS = 550;

/** Simulate a long-press at the centre of a locator's bounding box. */
async function longPress(page, locator) {
  const box = await locator.boundingBox();
  // Aim for the lower half of the card, left-of-centre, to land on a non-
  // interactive element (description / badge row, not the name link or gear button).
  const x = box.x + box.width * 0.25;
  const y = box.y + box.height * 0.6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(LONG_PRESS_HOLD_MS);
  await page.mouse.up();
}

test.describe("mobile layout", () => {
  test("renders single-column board with DayPicker", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // DayPicker button is visible
    const picker = page.getByRole("button", { name: /Choose day/ });
    await expect(picker).toBeVisible();

    // Today column visible with alpha-repo (Today / day-0)
    await expect(
      page.getByRole("group", { name: /Repository board/ }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: /alpha-repo/ })).toBeVisible();

    // beta-repo (day-1) and gamma-repo (day-2) are not displayed in the active column
    await expect(
      page.getByRole("group", { name: /beta-repo/ }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("group", { name: /gamma-repo/ }),
    ).not.toBeVisible();
  });

  test("DayPicker opens a column selector and switches the active column", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open DayPicker dropdown
    await page.getByRole("button", { name: /Choose day/ }).tap();

    const dialog = page.getByRole("dialog", { name: "Choose day" });
    await expect(dialog).toBeVisible();

    // Columns are listed with their repo counts
    await expect(dialog.getByRole("button", { name: /Today/ })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Tomorrow/ }),
    ).toBeVisible();

    // Select "Tomorrow" → beta-repo (day-1) becomes visible
    await dialog.getByRole("button", { name: /Tomorrow/ }).tap();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("group", { name: /beta-repo/ })).toBeVisible();
    await expect(
      page.getByRole("group", { name: /alpha-repo/ }),
    ).not.toBeVisible();
  });

  test("DayPicker closes on backdrop tap", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Choose day/ }).tap();
    const dialog = page.getByRole("dialog", { name: "Choose day" });
    await expect(dialog).toBeVisible();

    // Tap the backdrop (fixed full-screen overlay behind the dialog)
    await page.mouse.click(5, 5);
    await expect(dialog).not.toBeVisible();
  });

  test("long-press on a card opens the MoveSheet", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const card = page.getByRole("group", { name: /alpha-repo/ });
    await expect(card).toBeVisible();

    await longPress(page, card);

    // MoveSheet bottom-sheet appears
    const sheet = page.getByRole("dialog", { name: /Reschedule alpha-repo/ });
    await expect(sheet).toBeVisible();
  });

  test("MoveSheet preset buttons change the day input value", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const card = page.getByRole("group", { name: /alpha-repo/ });
    await longPress(page, card);

    const sheet = page.getByRole("dialog", { name: /Reschedule alpha-repo/ });
    await expect(sheet).toBeVisible();

    // Default value is the effective inactivity days (7 from the mock)
    const input = sheet.getByRole("spinbutton", {
      name: "Mark done for (days)",
    });
    await expect(input).toHaveValue("7");

    // Tap the 7-day preset
    await sheet.getByRole("button", { name: "7d" }).tap();
    await expect(input).toHaveValue("7");

    // Tap the 1-day preset
    await sheet.getByRole("button", { name: "1d" }).tap();
    await expect(input).toHaveValue("1");
  });

  test('MoveSheet "Mark done" submits snooze and closes the sheet', async ({
    page,
  }) => {
    const state = await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const card = page.getByRole("group", { name: /alpha-repo/ });
    await longPress(page, card);

    const sheet = page.getByRole("dialog", { name: /Reschedule alpha-repo/ });
    await expect(sheet).toBeVisible();

    // Change to 7 days via preset then submit
    await sheet.getByRole("button", { name: "7d" }).tap();
    await sheet.getByRole("button", { name: "Mark done" }).tap();

    // Sheet closes
    await expect(sheet).not.toBeVisible();

    // Mock state updated — alpha-repo moved out of Today
    const alpha = state.repos.find((r) => r.id === 1);
    expect(alpha.needsCheckToday).toBe(false);
  });

  test('MoveSheet "Cancel" closes without mutating state', async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const card = page.getByRole("group", { name: /alpha-repo/ });
    await longPress(page, card);

    const sheet = page.getByRole("dialog", { name: /Reschedule alpha-repo/ });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: "Cancel" }).tap();
    await expect(sheet).not.toBeVisible();

    // State unchanged
    expect(state.repos.find((r) => r.id === 1).column).toBe("day-0");
  });

  test('"More filters and options" button opens the MobileActionSheet', async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const moreBtn = page.getByRole("button", {
      name: "More filters and options",
    });
    await expect(moreBtn).toBeVisible();
    await moreBtn.tap();

    const sheet = page.getByRole("dialog", { name: "Filters & options" });
    await expect(sheet).toBeVisible();

    // Close via the X button
    await sheet.getByRole("button", { name: "Close options" }).tap();
    await expect(sheet).not.toBeVisible();
  });

  test("key touch targets meet the 44 px minimum height", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const minH = 44;
    const targets = [
      page.getByRole("button", { name: /Choose day/ }),
      page.getByRole("button", { name: "More filters and options" }),
      // Settings gear for alpha-repo
      page
        .getByRole("group", { name: /alpha-repo/ })
        .getByRole("button", { name: "Open repository settings" }),
    ];

    for (const t of targets) {
      await expect(t).toBeVisible();
      const box = await t.boundingBox();
      expect(
        box.height,
        `${await t.getAttribute("aria-label")} height`,
      ).toBeGreaterThanOrEqual(minH);
    }
  });
});
