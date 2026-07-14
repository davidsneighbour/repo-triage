import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// db.js reads DATA_DIR at import time. Point it at a throwaway dir and
// set TOKEN_PASSPHRASE BEFORE any app module is imported.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-dash-tokens-"));
process.env.DATA_DIR = tmpDir;
process.env.TOKEN_PASSPHRASE = "tokens-test-passphrase-42";
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
  buildResolveOwnerToken: vi.fn(() => () => ({
    token: "test-token",
    source: "env",
  })),
}));

const { app } = await import("./index.js");

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---- GET /api/tokens -------------------------------------------------------

describe("GET /api/tokens", () => {
  it("returns an empty list on a fresh database", async () => {
    const res = await request(app).get("/api/tokens");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tokens: [] });
  });
});

// ---- POST /api/tokens ------------------------------------------------------

describe("POST /api/tokens", () => {
  it("creates a token and returns id, name, owners", async () => {
    const res = await request(app)
      .post("/api/tokens")
      .send({ name: "my-token", token: "ghp_abc123", owners: "owner1,owner2" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      name: "my-token",
      owners: "owner1,owner2",
    });
  });

  it("accepts owners as an array and joins with commas", async () => {
    const res = await request(app)
      .post("/api/tokens")
      .send({
        name: "arr-token",
        token: "ghp_xyz",
        owners: ["ownerA", "ownerB"],
      });
    expect(res.status).toBe(201);
    expect(res.body.owners).toBe("ownerA,ownerB");
  });

  it("accepts a token with no owners (wildcard)", async () => {
    const res = await request(app)
      .post("/api/tokens")
      .send({ name: "wildcard", token: "ghp_wild" });
    expect(res.status).toBe(201);
    expect(res.body.owners).toBe("");
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/tokens")
      .send({ token: "ghp_abc" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when token is missing", async () => {
    const res = await request(app).post("/api/tokens").send({ name: "x" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("does not expose the plaintext token in the response", async () => {
    const secret = "ghp_super_secret_value";
    const res = await request(app)
      .post("/api/tokens")
      .send({ name: "hidden", token: secret });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain(secret);
  });
});

// ---- GET /api/tokens after inserts -----------------------------------------

describe("GET /api/tokens lists stored tokens", () => {
  it("returns all tokens with name and owners but no plaintext values", async () => {
    const res = await request(app).get("/api/tokens");
    expect(res.status).toBe(200);
    const { tokens } = res.body;
    expect(Array.isArray(tokens)).toBe(true);
    // Each row must have the safe fields and must NOT have token_encrypted etc.
    for (const t of tokens) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("owners");
      expect(t).toHaveProperty("created_at");
      expect(t).not.toHaveProperty("token_encrypted");
      expect(t).not.toHaveProperty("iv");
      expect(t).not.toHaveProperty("auth_tag");
      expect(t).not.toHaveProperty("salt");
    }
  });
});

// ---- PUT /api/tokens/:id ---------------------------------------------------

describe("PUT /api/tokens/:id", () => {
  let createdId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/tokens")
      .send({ name: "update-me", token: "ghp_original", owners: "org1" });
    createdId = res.body.id;
  });

  it("updates the token name", async () => {
    const res = await request(app)
      .put(`/api/tokens/${createdId}`)
      .send({ name: "updated-name" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("updates the owners list", async () => {
    const res = await request(app)
      .put(`/api/tokens/${createdId}`)
      .send({ owners: "org1,org2" });
    expect(res.status).toBe(200);
  });

  it("updates the token value (re-encrypts)", async () => {
    const res = await request(app)
      .put(`/api/tokens/${createdId}`)
      .send({ token: "ghp_new_value" });
    expect(res.status).toBe(200);
  });

  it("returns 400 when no update fields are provided", async () => {
    const res = await request(app).put(`/api/tokens/${createdId}`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent id", async () => {
    const res = await request(app).put("/api/tokens/99999").send({ name: "x" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await request(app).put("/api/tokens/abc").send({ name: "x" });
    expect(res.status).toBe(400);
  });
});

// ---- DELETE /api/tokens/:id ------------------------------------------------

describe("DELETE /api/tokens/:id", () => {
  let deleteId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/tokens")
      .send({ name: "to-delete", token: "ghp_del" });
    deleteId = res.body.id;
  });

  it("deletes an existing token", async () => {
    const res = await request(app).delete(`/api/tokens/${deleteId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 404 when deleting a non-existent token", async () => {
    const res = await request(app).delete(`/api/tokens/${deleteId}`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await request(app).delete("/api/tokens/abc");
    expect(res.status).toBe(400);
  });
});
