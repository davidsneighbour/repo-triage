import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { installFullBackup, validateFullBackup } from "./lib/fullRestore.js";
import { runMigrations } from "./lib/migrations.js";

let tmpDirs = [];

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

function makeMigratedDb() {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "repo-triage-fullrestore-"),
  );
  tmpDirs.push(dir);
  const dbPath = path.join(dir, "source.db");
  const db = new Database(dbPath);
  runMigrations(db);
  return { db, dbPath };
}

function gzipOf(dbPath) {
  return zlib.gzipSync(fs.readFileSync(dbPath));
}

describe("validateFullBackup", () => {
  it("rejects a buffer that isn't valid gzip", () => {
    const { db } = makeMigratedDb();
    const result = validateFullBackup(Buffer.from("not gzip at all"), db);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a valid gzip archive/);
    db.close();
  });

  it("rejects gzip data that isn't a valid SQLite database", () => {
    const { db } = makeMigratedDb();
    const result = validateFullBackup(
      zlib.gzipSync(Buffer.from("hello, this is not a database")),
      db,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a valid SQLite database/);
    db.close();
  });

  it("rejects an archive with a schema version newer than this server understands", () => {
    const { db: liveDb } = makeMigratedDb();
    const { db: futureDb, dbPath: futurePath } = makeMigratedDb();
    // user_version is a 32-bit signed int; stay comfortably under INT32_MAX
    // while still being far newer than any real migration version.
    const currentVersion = futureDb.pragma("user_version", { simple: true });
    futureDb.pragma(`user_version = ${currentVersion + 100000000}`);
    futureDb.close();

    const result = validateFullBackup(gzipOf(futurePath), liveDb);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/newer than this server understands/);
    liveDb.close();
  });

  it("rejects an archive missing a table the live schema expects", () => {
    const { db: sourceDb, dbPath: sourcePath } = makeMigratedDb();
    sourceDb.close();

    // A fake "live db" whose expected-table list names a table that will
    // never exist in the candidate — migrations only ever CREATE TABLE IF
    // NOT EXISTS, so a genuinely-dropped table would just get recreated;
    // this is the reliable way to exercise the "missing table" branch.
    const fakeLiveDb = {
      prepare: () => ({ all: () => [{ name: "totally_bogus_table" }] }),
    };

    const result = validateFullBackup(gzipOf(sourcePath), fakeLiveDb);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(
      /table "totally_bogus_table" is missing or unreadable|validation failed/,
    );
  });

  it("rejects an archive that fails SQLite's integrity check", () => {
    const { db: liveDb } = makeMigratedDb();
    const { db: sourceDb, dbPath: sourcePath } = makeMigratedDb();
    // Enough rows to force the repo_state b-tree past a single page, so a
    // later page holds real leaf-cell data rather than being free space —
    // corrupting free space is invisible to integrity_check.
    const insert = sourceDb.prepare(
      "INSERT INTO repo_state (repo_id, full_name, position, updated_at) VALUES (?, ?, 0, datetime('now'))",
    );
    for (let i = 0; i < 500; i++)
      insert.run(i, `me/repo-${i}-${"x".repeat(50)}`);
    sourceDb.close();

    const bytes = fs.readFileSync(sourcePath);
    const pageSize = 4096;
    // Page 30 (0-indexed) is a known-corruptible leaf page for this exact
    // row count/shape — flipping bytes there breaks a cell's content offset
    // while leaving the file openable.
    const start = 30 * pageSize + 50;
    for (let i = start; i < start + 500; i++) bytes[i] ^= 0xff;
    fs.writeFileSync(sourcePath, bytes);

    const result = validateFullBackup(zlib.gzipSync(bytes), liveDb);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/integrity check failed/);
    liveDb.close();
  });

  it("accepts a valid, up-to-date archive and reports table row counts", () => {
    const { db: liveDb } = makeMigratedDb();
    const { db: sourceDb, dbPath: sourcePath } = makeMigratedDb();
    sourceDb
      .prepare(
        "INSERT INTO repo_state (repo_id, full_name, position, updated_at) VALUES (1, 'me/repo', 0, datetime('now'))",
      )
      .run();
    sourceDb.close();

    const result = validateFullBackup(gzipOf(sourcePath), liveDb);
    expect(result.ok).toBe(true);
    expect(result.checks.integrity).toBe(true);
    expect(result.checks.migrated).toBe(true);
    expect(result.checks.tables.repo_state).toBe(1);
    expect(fs.existsSync(result.path)).toBe(true);

    fs.rmSync(result.path, { force: true });
    liveDb.close();
  });

  it("migrates an older archive up to the current schema", () => {
    const { db: liveDb } = makeMigratedDb();
    const { db: oldDb, dbPath: oldPath } = makeMigratedDb();
    // Simulate an archive taken before the most recent migration.
    const maxVersion = oldDb.pragma("user_version", { simple: true });
    oldDb.pragma(`user_version = ${maxVersion - 1}`);
    oldDb.close();

    const result = validateFullBackup(gzipOf(oldPath), liveDb);
    expect(result.ok).toBe(true);
    expect(result.checks.migrated).toBe(true);

    fs.rmSync(result.path, { force: true });
    liveDb.close();
  });
});

describe("installFullBackup", () => {
  it("swaps the candidate into the live path and keeps the previous file", () => {
    const { db: liveDb, dbPath: livePath } = makeMigratedDb();
    liveDb
      .prepare(
        "INSERT INTO repo_state (repo_id, full_name, position, updated_at) VALUES (1, 'me/old', 0, datetime('now'))",
      )
      .run();
    liveDb.close();

    const { db: candidateDb, dbPath: candidatePath } = makeMigratedDb();
    candidateDb
      .prepare(
        "INSERT INTO repo_state (repo_id, full_name, position, updated_at) VALUES (2, 'me/new', 0, datetime('now'))",
      )
      .run();
    candidateDb.close();

    const previousDbBackup = installFullBackup(candidatePath, livePath);

    expect(fs.existsSync(previousDbBackup)).toBe(true);
    expect(fs.existsSync(livePath)).toBe(true);
    expect(fs.existsSync(candidatePath)).toBe(false);

    const installed = new Database(livePath, { readonly: true });
    const rows = installed.prepare("SELECT full_name FROM repo_state").all();
    expect(rows).toEqual([{ full_name: "me/new" }]);
    installed.close();

    const previous = new Database(previousDbBackup, { readonly: true });
    const previousRows = previous
      .prepare("SELECT full_name FROM repo_state")
      .all();
    expect(previousRows).toEqual([{ full_name: "me/old" }]);
    previous.close();
  });
});
