/**
 * @module db
 * @description SQLite database handle. Opens the database file, enables WAL
 * journalling, and runs any pending schema migrations before exporting the
 * handle. Schema history lives in `server/lib/migrations.js`.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations } from './lib/migrations.js';

// Persist the DB in a mounted volume (/data in Docker). Fall back to ./data
// when running outside the container.
let dbDir = process.env.DATA_DIR || '/data';
try {
  fs.mkdirSync(dbDir, { recursive: true });
  fs.accessSync(dbDir, fs.constants.W_OK);
} catch {
  dbDir = path.resolve('./data');
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.join(dbDir, 'dashboard.db'));
db.pragma('journal_mode = WAL');

// Apply any pending schema migrations. This is synchronous and runs before
// any route module prepares statements, so the schema is always up to date
// by the time the first request arrives. A failed migration throws here,
// aborting startup rather than running against a broken schema.
runMigrations(db);

export default db;
