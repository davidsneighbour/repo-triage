import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// db.js reads DATA_DIR at import time, so point it at a throwaway dir BEFORE
// the app (and its SQLite singleton) are imported.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-dash-issues-"));
process.env.DATA_DIR = tmpDir;
process.env.SYNC_ON_STARTUP = "false";
process.env.SYNC_AUTO = "false";
process.env.GITHUB_TOKEN = "test-token";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

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

const { fetchAllRepos, fetchRepoIssues } = await import("./github.js");
const { app, refreshRepos } = await import("./index.js");

const REPO = { id: 201, full_name: "me/gamma", name: "gamma" };

beforeAll(async () => {
  fetchAllRepos.mockResolvedValue([REPO]);
  await refreshRepos(); // seeds repoCache + creates the repo_state row
});

beforeEach(() => {
  fetchRepoIssues.mockReset();
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/repos/:id/issues", () => {
  it("returns an empty list and syncEnabled:true before any sync has run", async () => {
    const res = await request(app).get(`/api/repos/${REPO.id}/issues`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ issues: [], syncEnabled: true });
  });

  it("returns 404 for an unknown repo id", async () => {
    const res = await request(app).get("/api/repos/999999/issues");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/repos/:id/issues/sync", () => {
  it("fetches and stores issues, then GET reflects them", async () => {
    fetchRepoIssues.mockResolvedValue([
      {
        number: 3,
        title: "triage this",
        state: "open",
        labels: ["help wanted"],
        body: "text",
        html_url: "https://x/3",
        github_updated_at: "2026-07-03T00:00:00Z",
      },
    ]);

    const syncRes = await request(app).post(
      `/api/repos/${REPO.id}/issues/sync`,
    );
    expect(syncRes.status).toBe(200);
    expect(syncRes.body).toEqual({ ok: true, count: 1 });

    const getRes = await request(app).get(`/api/repos/${REPO.id}/issues`);
    expect(getRes.body.issues).toHaveLength(1);
    expect(getRes.body.issues[0]).toMatchObject({
      number: 3,
      title: "triage this",
      labels: ["help wanted"],
    });
  });

  it("returns 404 for an unknown repo id", async () => {
    const res = await request(app).post("/api/repos/999999/issues/sync");
    expect(res.status).toBe(404);
  });

  it("returns 500 when the GitHub fetch fails", async () => {
    fetchRepoIssues.mockRejectedValue(new Error("GitHub API 404: Not Found"));
    const res = await request(app).post(`/api/repos/${REPO.id}/issues/sync`);
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("PUT /api/repos/:id/issue-sync", () => {
  it("disables and re-enables issue sync for a repo", async () => {
    let res = await request(app)
      .put(`/api/repos/${REPO.id}/issue-sync`)
      .send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, syncEnabled: false });

    res = await request(app).get(`/api/repos/${REPO.id}/issues`);
    expect(res.body.syncEnabled).toBe(false);

    res = await request(app)
      .put(`/api/repos/${REPO.id}/issue-sync`)
      .send({ enabled: true });
    expect(res.body).toEqual({ ok: true, syncEnabled: true });
  });

  it("returns 404 for an unknown repo id", async () => {
    const res = await request(app)
      .put("/api/repos/999999/issue-sync")
      .send({ enabled: false });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/repos/:id/issues/:number/flag", () => {
  it("flags a synced issue, is reflected in GET, and can be cleared", async () => {
    fetchRepoIssues.mockResolvedValue([
      {
        number: 9,
        title: "flag candidate",
        state: "open",
        labels: [],
        body: null,
        html_url: "https://x/9",
        github_updated_at: "2026-07-04T00:00:00Z",
      },
    ]);
    await request(app).post(`/api/repos/${REPO.id}/issues/sync`);

    let res = await request(app)
      .post(`/api/repos/${REPO.id}/issues/9/flag`)
      .send({ flagged: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, flagged: true });

    let getRes = await request(app).get(`/api/repos/${REPO.id}/issues`);
    expect(getRes.body.issues.find((i) => i.number === 9)).toMatchObject({
      flagged: true,
    });

    res = await request(app)
      .post(`/api/repos/${REPO.id}/issues/9/flag`)
      .send({ flagged: false });
    expect(res.body).toEqual({ ok: true, flagged: false });

    getRes = await request(app).get(`/api/repos/${REPO.id}/issues`);
    expect(getRes.body.issues.find((i) => i.number === 9)).toMatchObject({
      flagged: false,
    });
  });

  it("returns 404 for an unknown repo id", async () => {
    const res = await request(app)
      .post("/api/repos/999999/issues/9/flag")
      .send({ flagged: true });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric issue number", async () => {
    const res = await request(app)
      .post(`/api/repos/${REPO.id}/issues/abc/flag`)
      .send({ flagged: true });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the issue has never been synced", async () => {
    const res = await request(app)
      .post(`/api/repos/${REPO.id}/issues/424242/flag`)
      .send({ flagged: true });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/issues", () => {
  it("returns locally stored issues across repos with repo_full_name attached, without calling GitHub", async () => {
    fetchRepoIssues.mockResolvedValue([
      {
        number: 42,
        title: "cross-repo candidate",
        state: "open",
        labels: ["bug"],
        body: "text",
        html_url: "https://x/42",
        github_updated_at: "2026-07-05T00:00:00Z",
      },
    ]);
    await request(app).post(`/api/repos/${REPO.id}/issues/sync`);
    fetchRepoIssues.mockClear();

    const res = await request(app).get("/api/issues");
    expect(res.status).toBe(200);
    expect(fetchRepoIssues).not.toHaveBeenCalled();
    const entry = res.body.issues.find((i) => i.number === 42);
    expect(entry).toMatchObject({
      title: "cross-repo candidate",
      repo_id: REPO.id,
      repo_full_name: REPO.full_name,
      labels: ["bug"],
      flagged: false,
    });
  });
});

describe("POST /api/issues/sync", () => {
  it("syncs all enabled repos and reports warnings/lastRun", async () => {
    fetchRepoIssues.mockResolvedValue([]);
    const res = await request(app).post("/api/issues/sync");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      results: [{ repo: "me/gamma", ok: true, count: 0 }],
      warnings: expect.any(Array),
      lastRun: expect.any(String),
    });
  });
});
