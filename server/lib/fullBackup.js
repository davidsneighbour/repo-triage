/**
 * @module lib/fullBackup
 * @description Builds a redacted, consistent snapshot of the live SQLite
 * database for the full-system export (`GET /api/backup/full`). Unlike
 * `GET /api/backup` (triage-state JSON only), this covers every DB-backed
 * table — including `settings` and `prefs` — since they already live in the
 * same database file. Encrypted GitHub tokens are excluded: exports must
 * never carry secrets, matching the "no env vars" rule for this feature.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Creates a point-in-time snapshot of `db` via SQLite's online backup API
 * (safe under concurrent writers), strips the `tokens` table, and VACUUMs so
 * no redacted bytes linger in freed pages.
 *
 * @param {import('better-sqlite3').Database} db - Live database handle.
 * @returns {Promise<string>} Filesystem path to the redacted snapshot. The
 *   caller owns this file and must delete it once done streaming it.
 */
export async function createRedactedSnapshot(db) {
  const snapshotPath = path.join(
    os.tmpdir(),
    `repo-triage-backup-${crypto.randomUUID()}.db`,
  );
  await db.backup(snapshotPath);
  const snapshot = new Database(snapshotPath);
  try {
    snapshot.exec("DELETE FROM tokens");
    snapshot.exec("VACUUM");
  } finally {
    snapshot.close();
  }
  return snapshotPath;
}
