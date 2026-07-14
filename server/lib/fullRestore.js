/**
 * @module lib/fullRestore
 * @description Validates and installs a full-database export produced by
 * `GET /api/backup/full` (see `lib/fullBackup.js`). Never touches the live
 * database until a candidate file has passed every check — an invalid or
 * incompatible archive leaves the running instance untouched.
 *
 * The live `db` singleton (`server/db.js`) is imported once at process
 * startup and every route module pre-`prepare()`s statements against that
 * exact connection, so there is no safe way to hot-swap the open handle
 * in-place. Instead, `installFullBackup()` renames the validated file into
 * place on disk; the running process keeps serving the old data from its
 * already-open file handle until the next restart, which is when `db.js`
 * opens the newly installed file.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import Database from "better-sqlite3";
import { MIGRATIONS, runMigrations } from "./migrations.js";

const MAX_KNOWN_VERSION = MIGRATIONS.at(-1).version;

function cleanup(candidatePath) {
  fs.rmSync(candidatePath, { force: true });
  for (const suffix of ["-wal", "-shm"]) {
    fs.rmSync(`${candidatePath}${suffix}`, { force: true });
  }
}

/**
 * Decompresses and validates a candidate full-database export against the
 * live database's expected table set. Runs the standard migration path so
 * older archives are brought up to the current schema, then confirms every
 * table the live schema defines is present and readable in the candidate.
 *
 * @param {Buffer} gzipBuffer - Raw gzip-compressed SQLite file body.
 * @param {import('better-sqlite3').Database} liveDb - The running server's
 *   database handle, used only to read the expected table list — never
 *   written to.
 * @returns {{ ok: true, path: string, checks: object } | { ok: false, error: string, checks?: object }}
 */
export function validateFullBackup(gzipBuffer, liveDb) {
  const candidatePath = path.join(
    os.tmpdir(),
    `repo-triage-restore-${crypto.randomUUID()}.db`,
  );

  let dbBuffer;
  try {
    dbBuffer = zlib.gunzipSync(gzipBuffer);
  } catch (e) {
    return {
      ok: false,
      error: `not a valid gzip archive: ${String(e.message || e)}`,
    };
  }
  fs.writeFileSync(candidatePath, dbBuffer);

  let candidate;
  try {
    candidate = new Database(candidatePath);
    // The exported file inherits WAL mode from the live DB it was snapshot
    // from; switch back to a single-file journal so validation never leaves
    // stray -wal/-shm siblings behind.
    candidate.pragma("journal_mode = DELETE");
  } catch (e) {
    cleanup(candidatePath);
    return {
      ok: false,
      error: `not a valid SQLite database: ${String(e.message || e)}`,
    };
  }

  const checks = { integrity: false, migrated: false, tables: {} };
  try {
    const versionBefore = candidate.pragma("user_version", { simple: true });
    if (versionBefore > MAX_KNOWN_VERSION) {
      candidate.close();
      cleanup(candidatePath);
      return {
        ok: false,
        error: `archive schema version (${versionBefore}) is newer than this server understands (${MAX_KNOWN_VERSION}); upgrade the server before restoring this archive`,
      };
    }

    runMigrations(candidate);
    checks.migrated = true;

    const integrity = candidate.pragma("integrity_check", { simple: true });
    checks.integrity = integrity === "ok";
    if (!checks.integrity) {
      candidate.close();
      cleanup(candidatePath);
      return {
        ok: false,
        error: `integrity check failed: ${integrity}`,
        checks,
      };
    }

    const expectedTables = liveDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((r) => r.name);
    for (const table of expectedTables) {
      const { count } = candidate
        .prepare(`SELECT COUNT(*) AS count FROM "${table}"`)
        .get();
      checks.tables[table] = count;
    }
  } catch (e) {
    candidate.close();
    cleanup(candidatePath);
    return {
      ok: false,
      error: `validation failed: ${String(e.message || e)}`,
      checks,
    };
  }

  candidate.close();
  return { ok: true, path: candidatePath, checks };
}

/**
 * Installs a validated candidate database file in place of the live one.
 * The previous file is kept alongside it as a timestamped backup rather than
 * deleted. The live process must restart to pick up the new data.
 *
 * @param {string} candidatePath - Path returned by a successful `validateFullBackup()`.
 * @param {string} liveDbPath - Path to the live database file (`db.name`).
 * @returns {string} Path the previous live database file was moved to.
 */
export function installFullBackup(candidatePath, liveDbPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const previousDbBackup = `${liveDbPath}.pre-restore-${stamp}`;
  fs.renameSync(liveDbPath, previousDbBackup);
  fs.renameSync(candidatePath, liveDbPath);
  return previousDbBackup;
}
