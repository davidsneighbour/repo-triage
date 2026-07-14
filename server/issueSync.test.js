import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// DATA_DIR and env flags must be set BEFORE any module imports.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-dash-issuesync-"));
process.env.DATA_DIR = tmpDir;
process.env.SYNC_ON_STARTUP = "false";
process.env.SYNC_AUTO = "false";
process.env.GITHUB_TOKEN = "test-token";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const rateLimit = {
  limit: 5000,
  remaining: 4999,
  used: 1,
  reset: null,
  lastChecked: null,
  authInvalid: false,
};

vi.mock("./github.js", () => ({
  rateLimit,
  sourceStatus: { owners: [], warnings: [] },
  authStatus: { source: "env", present: true },
  fetchAllRepos: vi.fn(),
  fetchRepoIssues: vi.fn(),
  buildResolveOwnerToken: vi.fn(() => () => ({
    token: "test-token",
    source: "env",
  })),
  parseRateLimitHeaders: vi.fn(),
  parseOwners: (raw) =>
    raw
      ? String(raw)
          .split(/[\s,]+/)
          .filter(Boolean)
      : [],
}));

vi.mock("./lib/reportSchedule.js", () => ({ checkReportSchedule: vi.fn() }));

const { fetchAllRepos, fetchRepoIssues, buildResolveOwnerToken } = await import(
  "./github.js"
);
const { refreshRepos } = await import("./lib/sync.js");
const db = (await import("./db.js")).default;
const {
  getAllStoredIssues,
  getStoredIssues,
  isIssueSyncEnabled,
  issueSyncStatus,
  restartIssueSyncInterval,
  setIssueFlagged,
  setIssueSyncEnabled,
  syncAllRepoIssues,
  syncRepoIssues,
} = await import("./lib/issueSync.js");

const REPO_A = { id: 1, full_name: "me/alpha" };
const REPO_B = { id: 2, full_name: "me/beta" };

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeAll(async () => {
  fetchAllRepos.mockResolvedValue([REPO_A, REPO_B]);
  await refreshRepos(); // seeds repoCache + repo_state rows for both repos
});

beforeEach(() => {
  fetchRepoIssues.mockReset();
  buildResolveOwnerToken.mockReturnValue(() => ({
    token: "test-token",
    source: "env",
  }));
  Object.assign(rateLimit, { remaining: 4999 });
  issueSyncStatus.warnings = [];
});

describe("isIssueSyncEnabled / setIssueSyncEnabled", () => {
  it("defaults to enabled for a repo with no override", () => {
    expect(isIssueSyncEnabled(REPO_A.id)).toBe(true);
  });

  it("defaults to enabled for a repo with no repo_state row at all", () => {
    expect(isIssueSyncEnabled(999999)).toBe(true);
  });

  it("can be disabled and re-enabled", () => {
    setIssueSyncEnabled(REPO_A.id, false);
    expect(isIssueSyncEnabled(REPO_A.id)).toBe(false);
    setIssueSyncEnabled(REPO_A.id, true);
    expect(isIssueSyncEnabled(REPO_A.id)).toBe(true);
  });
});

describe("getStoredIssues", () => {
  it("falls back to an empty array when a stored row has no labels", () => {
    db.prepare(`
      INSERT INTO repo_issue (repo_id, number, title, state, labels, body, html_url, github_updated_at, synced_at)
      VALUES (?, ?, ?, ?, '', NULL, NULL, NULL, ?)
    `).run(REPO_B.id, 4242, "no labels row", "open", new Date().toISOString());

    const stored = getStoredIssues(REPO_B.id).find((i) => i.number === 4242);
    expect(stored.labels).toEqual([]);
  });
});

describe("syncRepoIssues", () => {
  it("persists fetched issues and getStoredIssues returns them with parsed labels", async () => {
    fetchRepoIssues.mockResolvedValue([
      {
        number: 5,
        title: "first",
        state: "open",
        labels: ["bug"],
        body: "x",
        html_url: "https://x/5",
        github_updated_at: "2026-07-01T00:00:00Z",
      },
    ]);

    const result = await syncRepoIssues(REPO_A);
    expect(result).toEqual({ ok: true, count: 1 });

    const stored = getStoredIssues(REPO_A.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      number: 5,
      title: "first",
      state: "open",
      labels: ["bug"],
    });
  });

  it("upserts on re-sync instead of duplicating rows", async () => {
    fetchRepoIssues.mockResolvedValue([
      {
        number: 5,
        title: "first (edited)",
        state: "closed",
        labels: [],
        body: null,
        html_url: "https://x/5",
        github_updated_at: "2026-07-02T00:00:00Z",
      },
    ]);

    await syncRepoIssues(REPO_A);
    const stored = getStoredIssues(REPO_A.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      title: "first (edited)",
      state: "closed",
    });
  });

  it("returns ok:false and records a warning when no token is available", async () => {
    const result = await syncRepoIssues(REPO_B, () => ({
      token: null,
      source: null,
    }));
    expect(result).toEqual({ ok: false, count: 0 });
    expect(issueSyncStatus.warnings.join(" ")).toMatch(
      /No token available for "me\/beta"/,
    );
    expect(fetchRepoIssues).not.toHaveBeenCalled();
  });

  it("does not clear a flagged issue when it is re-synced", async () => {
    fetchRepoIssues.mockResolvedValue([
      {
        number: 6,
        title: "flag me",
        state: "open",
        labels: [],
        body: null,
        html_url: "https://x/6",
        github_updated_at: "2026-07-01T00:00:00Z",
      },
    ]);
    await syncRepoIssues(REPO_A);
    setIssueFlagged(REPO_A.id, 6, true);
    expect(getStoredIssues(REPO_A.id).find((i) => i.number === 6).flagged).toBe(
      true,
    );

    // Re-sync with updated content — the flag must survive the upsert.
    fetchRepoIssues.mockResolvedValue([
      {
        number: 6,
        title: "flag me (edited)",
        state: "closed",
        labels: [],
        body: null,
        html_url: "https://x/6",
        github_updated_at: "2026-07-03T00:00:00Z",
      },
    ]);
    await syncRepoIssues(REPO_A);
    const stored = getStoredIssues(REPO_A.id).find((i) => i.number === 6);
    expect(stored).toMatchObject({
      title: "flag me (edited)",
      state: "closed",
      flagged: true,
    });
  });
});

describe("setIssueFlagged", () => {
  it("sets and clears the flagged marker, returning false for an unknown issue", async () => {
    fetchRepoIssues.mockResolvedValue([
      {
        number: 7,
        title: "flaggable",
        state: "open",
        labels: [],
        body: null,
        html_url: "https://x/7",
        github_updated_at: "2026-07-01T00:00:00Z",
      },
    ]);
    await syncRepoIssues(REPO_A);

    expect(setIssueFlagged(REPO_A.id, 7, true)).toBe(true);
    expect(getStoredIssues(REPO_A.id).find((i) => i.number === 7).flagged).toBe(
      true,
    );

    expect(setIssueFlagged(REPO_A.id, 7, false)).toBe(true);
    expect(getStoredIssues(REPO_A.id).find((i) => i.number === 7).flagged).toBe(
      false,
    );

    expect(setIssueFlagged(REPO_A.id, 99999, true)).toBe(false);
  });
});

describe("syncAllRepoIssues", () => {
  it("syncs every enabled repo and skips disabled ones", async () => {
    setIssueSyncEnabled(REPO_A.id, true);
    setIssueSyncEnabled(REPO_B.id, false);
    fetchRepoIssues.mockResolvedValue([]);

    const results = await syncAllRepoIssues();

    expect(results).toEqual([{ repo: "me/alpha", ok: true, count: 0 }]);
    expect(fetchRepoIssues).toHaveBeenCalledTimes(1);
    expect(fetchRepoIssues).toHaveBeenCalledWith("me/alpha", "test-token");
    expect(issueSyncStatus.lastRun).not.toBeNull();

    setIssueSyncEnabled(REPO_B.id, true); // restore for later tests
  });

  it("records a warning and continues past a single-repo failure", async () => {
    fetchRepoIssues.mockRejectedValueOnce(new Error("repo renamed"));
    fetchRepoIssues.mockResolvedValueOnce([]);

    const results = await syncAllRepoIssues();

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ok: false, count: 0 }),
      ]),
    );
    expect(issueSyncStatus.warnings.join(" ")).toMatch(/Could not sync issues/);
  });

  it("stops early and warns when the rate-limit budget is low", async () => {
    Object.assign(rateLimit, { remaining: 10 });
    fetchRepoIssues.mockResolvedValue([]);

    const results = await syncAllRepoIssues();

    expect(results).toEqual([]);
    expect(fetchRepoIssues).not.toHaveBeenCalled();
    expect(issueSyncStatus.warnings.join(" ")).toMatch(/rate limit budget low/);
  });
});

describe("getAllStoredIssues", () => {
  it("returns issues across every repo, most recently active first", async () => {
    Object.assign(rateLimit, { remaining: 4999 });
    fetchRepoIssues.mockResolvedValue([
      {
        number: 100,
        title: "alpha older",
        state: "open",
        labels: [],
        body: null,
        html_url: null,
        github_updated_at: "2026-06-01T00:00:00Z",
      },
    ]);
    await syncRepoIssues(REPO_A);
    fetchRepoIssues.mockResolvedValue([
      {
        number: 101,
        title: "beta newer",
        state: "open",
        labels: ["bug"],
        body: null,
        html_url: null,
        github_updated_at: "2026-07-08T00:00:00Z",
      },
    ]);
    await syncRepoIssues(REPO_B);

    const all = getAllStoredIssues();
    const alpha = all.find((i) => i.repo_id === REPO_A.id && i.number === 100);
    const beta = all.find((i) => i.repo_id === REPO_B.id && i.number === 101);
    expect(alpha).toBeDefined();
    expect(beta).toMatchObject({ labels: ["bug"], flagged: false });
    expect(all.indexOf(beta)).toBeLessThan(all.indexOf(alpha));
  });
});

describe("restartIssueSyncInterval", () => {
  it("runs syncAllRepoIssues on the configured interval and can be cleared", () => {
    vi.useFakeTimers();
    fetchRepoIssues.mockResolvedValue([]);
    Object.assign(rateLimit, { remaining: 4999 });

    restartIssueSyncInterval(1);
    vi.advanceTimersByTime(60_000);

    restartIssueSyncInterval(0); // clears without starting a new timer
    vi.useRealTimers();
  });
});
