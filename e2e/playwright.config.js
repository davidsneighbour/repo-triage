const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      // Use the system-installed Google Chrome when running locally.
      // CI downloads the managed Chromium via `playwright install chromium`.
      use: process.env.CI
        ? { ...devices["Desktop Chrome"] }
        : { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  // Requires the client to be pre-built (`npm --prefix client run build`).
  webServer: {
    command: "npm --prefix ../client run preview -- --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
