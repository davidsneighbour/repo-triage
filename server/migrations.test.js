import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, MIGRATIONS } from './lib/migrations.js';

// Each test gets its own isolated in-memory (or tmp-file) database so
// migrations don't bleed across cases.
let db;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
});

afterEach(() => {
  db.close();
});

// ---- helpers ---------------------------------------------------------------

function schemaVersion() {
  return db.pragma('user_version', { simple: true });
}

function tableNames() {
  return db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all()
    .map((r) => r.name);
}

// ---- test suite ------------------------------------------------------------

describe('runMigrations', () => {
  it('applies all migrations to a fresh database', () => {
    expect(schemaVersion()).toBe(0);
    runMigrations(db);
    expect(schemaVersion()).toBe(MIGRATIONS.at(-1).version);
    // All expected tables exist after the initial migration.
    const tables = tableNames();
    for (const t of ['repo_state', 'repo_notice', 'repo_tag', 'repo_flag',
      'prefs', 'settings', 'tag_rule', 'undo_log', 'activity_log']) {
      expect(tables, `table ${t} should exist`).toContain(t);
    }
  });

  it('is a no-op when the database is already at the latest version', () => {
    runMigrations(db);
    const versionAfterFirst = schemaVersion();
    // Running again must not throw and must not change the version.
    runMigrations(db);
    expect(schemaVersion()).toBe(versionAfterFirst);
  });

  it('applies only migrations newer than the current version (one-step upgrade)', () => {
    const v1 = 1000000001;
    const v2 = 1000000002;
    const migrations = [
      { version: v1, description: 'step 1', up(d) { d.exec('CREATE TABLE t1 (id INTEGER)'); } },
      { version: v2, description: 'step 2', up(d) { d.exec('CREATE TABLE t2 (id INTEGER)'); } },
    ];
    // Simulate a DB that already has v1 applied.
    db.exec(`PRAGMA user_version = ${v1}`);
    runMigrations(db, migrations);
    // Only v2 should have run.
    expect(schemaVersion()).toBe(v2);
    expect(tableNames()).not.toContain('t1');
    expect(tableNames()).toContain('t2');
  });

  it('applies multiple pending migrations in version order (multi-step upgrade)', () => {
    const migrations = [
      { version: 100, description: 'first',  up(d) { d.exec('CREATE TABLE a (x INTEGER)'); } },
      { version: 200, description: 'second', up(d) { d.exec('CREATE TABLE b (x INTEGER)'); } },
      { version: 300, description: 'third',  up(d) { d.exec('CREATE TABLE c (x INTEGER)'); } },
    ];
    runMigrations(db, migrations);
    expect(schemaVersion()).toBe(300);
    expect(tableNames()).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('rolls back a failed migration and leaves the database unchanged', () => {
    const goodVersion = 100;
    const badVersion  = 200;
    const migrations = [
      { version: goodVersion, description: 'good', up(d) { d.exec('CREATE TABLE ok (x INTEGER)'); } },
      {
        version: badVersion,
        description: 'bad',
        up(d) {
          d.exec('CREATE TABLE partial (x INTEGER)');
          throw new Error('intentional failure');
        },
      },
    ];

    expect(() => runMigrations(db, migrations)).toThrow(/migration 200.*failed/i);

    // The good migration ran first and committed.
    expect(schemaVersion()).toBe(goodVersion);
    expect(tableNames()).toContain('ok');

    // The bad migration's partial work (CREATE TABLE partial) was rolled back.
    expect(tableNames()).not.toContain('partial');

    // The bad migration's version was NOT written.
    expect(schemaVersion()).toBe(goodVersion);
  });

  it('back-fills ignored/checked_at/snooze_until on a pre-column repo_state table', () => {
    // Simulate a very old DB: repo_state exists but lacks the three columns
    // added in early ad-hoc ALTER TABLE patches.
    db.exec(`
      CREATE TABLE repo_state (
        repo_id         INTEGER PRIMARY KEY,
        full_name       TEXT,
        priority        INTEGER,
        priority_set_at TEXT,
        inactivity_days INTEGER,
        position        INTEGER DEFAULT 0,
        updated_at      TEXT
      );
      INSERT INTO repo_state (repo_id, full_name, priority_set_at)
      VALUES (1, 'me/alpha', '2026-06-01T00:00:00.000Z');
    `);
    runMigrations(db);
    const cols = db.prepare('PRAGMA table_info(repo_state)').all().map((r) => r.name);
    expect(cols).toContain('ignored');
    expect(cols).toContain('checked_at');
    expect(cols).toContain('snooze_until');
    // checked_at back-filled from priority_set_at
    const row = db.prepare('SELECT checked_at FROM repo_state WHERE repo_id = 1').get();
    expect(row.checked_at).toBe('2026-06-01T00:00:00.000Z');
  });

  it('re-runs the initial migration safely against a DB that already has the tables', () => {
    // Simulate a DB that was set up by the old inline-creation code in db.js:
    // tables exist but user_version = 0.
    db.exec(`
      CREATE TABLE repo_state (
        repo_id INTEGER PRIMARY KEY, full_name TEXT, priority INTEGER,
        priority_set_at TEXT, checked_at TEXT, inactivity_days INTEGER,
        position INTEGER DEFAULT 0, ignored INTEGER DEFAULT 0,
        snooze_until TEXT, updated_at TEXT
      );
    `);
    expect(schemaVersion()).toBe(0);
    // runMigrations should not throw even though repo_state already exists.
    expect(() => runMigrations(db)).not.toThrow();
    expect(schemaVersion()).toBe(MIGRATIONS[0].version);
  });
});
