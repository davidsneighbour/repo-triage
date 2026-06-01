import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

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

// Only triage state lives locally. The repo list itself always comes fresh
// from GitHub, so we never get out of sync with reality.
db.exec(`
  CREATE TABLE IF NOT EXISTS repo_state (
    repo_id         INTEGER PRIMARY KEY,
    full_name       TEXT,
    priority        INTEGER,          -- 1..3 = assigned, NULL = inbox / untriaged
    priority_set_at TEXT,             -- ISO time of the last triage or "I looked" touch
    inactivity_days INTEGER,          -- per-repo override; NULL = use the global default
    position        INTEGER DEFAULT 0,-- ordering within a column (for drag sorting)
    updated_at      TEXT
  );
`);

export default db;
