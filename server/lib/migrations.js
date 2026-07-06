/**
 * Versioned schema migration runner.
 *
 * Each entry in MIGRATIONS describes one schema change: a numeric version
 * (yyyymmddNN), a description, and an `up(db)` function that applies the
 * change using the better-sqlite3 handle. The runner wraps each migration in
 * a transaction — if `up()` throws, the transaction rolls back automatically
 * and the server refuses to start rather than continuing with a half-applied
 * schema. The applied version is tracked via SQLite's built-in
 * `PRAGMA user_version` (a 32-bit integer stored in the DB header; no extra
 * table needed).
 *
 * To add a new migration:
 *   1. Append an entry to MIGRATIONS with the next version number and a short
 *      description of what changes (keep entries in ascending version order).
 *   2. Implement `up(db)` using better-sqlite3 synchronous APIs only.
 *   3. Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and
 *      PRAGMA table_info guards for `ALTER TABLE ADD COLUMN` so the migration
 *      is safe to re-run against a DB that was partially updated.
 *
 * See CLAUDE.md § Database migrations for the full authoring guide.
 */

export const MIGRATIONS = [
  {
    version: 2026062001,
    description: 'initial schema: all tables, indexes, and column back-fills',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS repo_state (
          repo_id         INTEGER PRIMARY KEY,
          full_name       TEXT,
          priority        INTEGER,
          priority_set_at TEXT,
          checked_at      TEXT,
          inactivity_days INTEGER,
          position        INTEGER DEFAULT 0,
          ignored         INTEGER DEFAULT 0,
          snooze_until    TEXT,
          updated_at      TEXT
        );
      `);

      // Back-fill columns that were added after the original release.
      const cols = db.prepare('PRAGMA table_info(repo_state)').all().map((c) => c.name);
      if (!cols.includes('ignored')) {
        db.exec(`ALTER TABLE repo_state ADD COLUMN ignored INTEGER DEFAULT 0`);
      }
      if (!cols.includes('checked_at')) {
        db.exec(`ALTER TABLE repo_state ADD COLUMN checked_at TEXT`);
        db.exec(`UPDATE repo_state SET checked_at = priority_set_at WHERE checked_at IS NULL AND priority_set_at IS NOT NULL`);
      }
      if (!cols.includes('snooze_until')) {
        db.exec(`ALTER TABLE repo_state ADD COLUMN snooze_until TEXT`);
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS repo_notice (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id    INTEGER NOT NULL,
          full_name  TEXT,
          body       TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_repo_notice_repo ON repo_notice (repo_id, id);

        CREATE TABLE IF NOT EXISTS repo_tag (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id    INTEGER NOT NULL,
          full_name  TEXT,
          tag        TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (repo_id, tag)
        );
        CREATE INDEX IF NOT EXISTS idx_repo_tag_repo ON repo_tag (repo_id);
        CREATE INDEX IF NOT EXISTS idx_repo_tag_tag ON repo_tag (tag);

        CREATE TABLE IF NOT EXISTS repo_flag (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id    INTEGER NOT NULL,
          full_name  TEXT,
          flag       TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (repo_id, flag)
        );
        CREATE INDEX IF NOT EXISTS idx_repo_flag_repo ON repo_flag (repo_id);

        CREATE TABLE IF NOT EXISTS prefs (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tag_rule (
          tag        TEXT PRIMARY KEY,
          days       INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS undo_log (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          label      TEXT NOT NULL,
          ops        TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_log (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          repo_id    INTEGER NOT NULL,
          full_name  TEXT NOT NULL,
          action     TEXT NOT NULL,
          detail     TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS activity_log_repo_id ON activity_log(repo_id);
      `);
    },
  },
  {
    version: 2026062301,
    description: 'add tokens table for encrypted per-owner GitHub token storage',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tokens (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          name            TEXT NOT NULL,
          token_encrypted TEXT NOT NULL,
          iv              TEXT NOT NULL,
          auth_tag        TEXT NOT NULL,
          salt            TEXT NOT NULL,
          owners          TEXT NOT NULL DEFAULT '',
          created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_tokens_name ON tokens (name);
      `);
    },
  },
  {
    version: 2026070601,
    description: 'add repo_issue table and per-repo issue-sync opt-out column',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS repo_issue (
          repo_id           INTEGER NOT NULL,
          number            INTEGER NOT NULL,
          title             TEXT NOT NULL,
          state             TEXT NOT NULL,
          labels            TEXT NOT NULL DEFAULT '[]',
          body              TEXT,
          html_url          TEXT,
          github_updated_at TEXT,
          synced_at         TEXT NOT NULL,
          PRIMARY KEY (repo_id, number)
        );
        CREATE INDEX IF NOT EXISTS idx_repo_issue_repo_id ON repo_issue (repo_id);
      `);

      // Issue sync is opt-out (enabled by default) — see repo_state.issue_sync_enabled.
      const cols = db.prepare('PRAGMA table_info(repo_state)').all().map((c) => c.name);
      if (!cols.includes('issue_sync_enabled')) {
        db.exec(`ALTER TABLE repo_state ADD COLUMN issue_sync_enabled INTEGER DEFAULT 1`);
      }
    },
  },
  {
    version: 2026070602,
    description: 'add local flagged column to repo_issue for issue-level priority marking',
    up(db) {
      const cols = db.prepare('PRAGMA table_info(repo_issue)').all().map((c) => c.name);
      if (!cols.includes('flagged')) {
        db.exec(`ALTER TABLE repo_issue ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0`);
      }
    },
  },
];

/**
 * Run all pending migrations against `db` in version order.
 *
 * Each migration runs inside a transaction. On failure the transaction rolls
 * back automatically and an error is thrown — the caller should treat this as
 * fatal and abort startup.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {typeof MIGRATIONS} migrations - Overridable for tests.
 */
export function runMigrations(db, migrations = MIGRATIONS) {
  const current = db.pragma('user_version', { simple: true });
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);

  for (const m of pending) {
    try {
      db.transaction(() => {
        m.up(db);
        db.exec(`PRAGMA user_version = ${m.version}`);
      })();
    } catch (e) {
      throw new Error(`migration ${m.version} (${m.description}) failed — ${e.message}`);
    }
  }
}
