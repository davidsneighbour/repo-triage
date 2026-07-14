import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // db.js is pure bootstrap (SQLite connection, DDL, one-time column
      // migrations) with no business logic to assert; exclude it so the
      // thresholds measure testable code, not schema setup.
      exclude: ["db.js", "**/*.config.js", "**/*.test.js"],
      // don't trip CI; raise as coverage improves.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 85,
        lines: 90,
      },
    },
  },
});
