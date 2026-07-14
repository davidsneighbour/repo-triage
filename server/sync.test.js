import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// DATA_DIR and env flags must be set BEFORE any module imports.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-dash-sync-"));
process.env.DATA_DIR = tmpDir;
process.env.SYNC_ON_STARTUP = "false";
process.env.SYNC_AUTO = "false";
process.env.GITHUB_TOKEN = "test-token";
// Enable enrichment so the ENRICH_METADATA branch in refreshRepos is exercised.
process.env.ENRICH_METADATA = "true";

vi.mock("./github.js", () => ({
  rateLimit: {
    limit: 5000,
    remaining: 4999,
    used: 1,
    reset: null,
    lastChecked: null,
    authInvalid: false,
  },
  sourceStatus: { owners: [], warnings: [] },
  authStatus: { source: "env", present: true },
  fetchAllRepos: vi
    .fn()
    .mockResolvedValue([
      { id: 99, full_name: "me/enrich-test", name: "enrich-test" },
    ]),
  enrichRepos: vi.fn().mockResolvedValue(new Map()),
  resolveToken: vi.fn().mockReturnValue({ token: "test-token" }),
  parseRateLimitHeaders: vi.fn(),
  parseOwners: (raw) =>
    raw
      ? String(raw)
          .split(/[\s,]+/)
          .filter(Boolean)
      : [],
}));

vi.mock("./lib/reportSchedule.js", () => ({ checkReportSchedule: vi.fn() }));

const { enrichRepos } = await import("./github.js");
const { refreshRepos } = await import("./lib/sync.js");

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("sync — ENRICH_METADATA=true path", () => {
  beforeAll(async () => {
    await refreshRepos();
    // enrichRepos runs in the background after refreshRepos resolves;
    // wait a tick for the Promise chain to settle.
    await new Promise((r) => setTimeout(r, 20));
  });

  it("calls enrichRepos after a successful sync", () => {
    expect(enrichRepos).toHaveBeenCalled();
  });

  it("passes the repo snapshot and token to enrichRepos", () => {
    const [snap, token] = enrichRepos.mock.calls[0];
    expect(Array.isArray(snap)).toBe(true);
    expect(typeof token).toBe("string");
  });
});
