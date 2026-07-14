import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const tmpDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "repo-dash-settingssets-"),
);
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
  parseRateLimitHeaders: vi.fn(),
  parseOwners: (raw) =>
    raw
      ? String(raw)
          .split(/[\s,]+/)
          .filter(Boolean)
      : [],
}));

const { fetchAllRepos } = await import("./github.js");
const { app, refreshRepos } = await import("./index.js");

const HYGIENIC_REPO = {
  id: 301,
  full_name: "me/hygienic",
  name: "hygienic",
  description: "a well-kept repo",
  license: "MIT",
  topics: ["cli"],
  has_issues: true,
  has_wiki: false,
};
const BARE_REPO = {
  id: 302,
  full_name: "me/bare",
  name: "bare",
  description: null,
  license: null,
  topics: [],
  has_issues: false,
  has_wiki: true,
};

beforeAll(async () => {
  fetchAllRepos.mockResolvedValue([HYGIENIC_REPO, BARE_REPO]);
  await refreshRepos();
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/settings-sets", () => {
  it("lists available presets as summaries", async () => {
    const res = await request(app).get("/api/settings-sets");
    expect(res.status).toBe(200);
    expect(res.body.presets).toEqual([
      {
        id: "hygiene",
        name: "Repo hygiene",
        description: expect.any(String),
        checkCount: 5,
      },
    ]);
  });
});

describe("GET /api/repos/:id/settings-sets/:presetId", () => {
  it("scores a hygienic repo at 5/5", async () => {
    const res = await request(app).get(
      `/api/repos/${HYGIENIC_REPO.id}/settings-sets/hygiene`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      presetId: "hygiene",
      presetName: "Repo hygiene",
      passCount: 5,
      total: 5,
    });
  });

  it("scores a bare repo at 0/5", async () => {
    const res = await request(app).get(
      `/api/repos/${BARE_REPO.id}/settings-sets/hygiene`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ passCount: 0, total: 5 });
  });

  it("returns 404 for an unknown repo id", async () => {
    const res = await request(app).get(
      "/api/repos/999999/settings-sets/hygiene",
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/repo not found/);
  });

  it("returns 404 for an unknown preset id", async () => {
    const res = await request(app).get(
      `/api/repos/${HYGIENIC_REPO.id}/settings-sets/does-not-exist`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/preset not found/);
  });
});
