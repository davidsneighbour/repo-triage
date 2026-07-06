import db from '../db.js';
import { parseOwners } from '../github.js';

export const DEFAULT_INACTIVITY_DAYS_ENV = Number(process.env.DEFAULT_INACTIVITY_DAYS || 7);
export const DAY_ROLLOVER_HOUR = Math.min(23, Math.max(0, Math.floor(Number(process.env.DAY_ROLLOVER_HOUR ?? 4)) || 0));
export const SYNC_ON_STARTUP = process.env.SYNC_ON_STARTUP !== 'false';
export const SYNC_AUTO = process.env.SYNC_AUTO !== 'false';
export const SYNC_INTERVAL_MINUTES_ENV = Math.max(1, Number(process.env.SYNC_INTERVAL_MINUTES || 60));
export const ENRICH_METADATA = (process.env.ENRICH_METADATA || '').toLowerCase() === 'true';
// Default: 10080 minutes = 7 days. Issue sync is opt-out per repo (see repo_state.issue_sync_enabled),
// so the interval stays coarse-grained by default to bound GitHub API cost across all tracked repos.
export const ISSUE_SYNC_INTERVAL_MINUTES_ENV = Math.max(1, Number(process.env.ISSUE_SYNC_INTERVAL_MINUTES || 10080));

export const ALLOWED_SETTING_KEYS = new Set(['defaultInactivityDays', 'syncIntervalMinutes', 'githubOwners']);

const settingGetStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
export const settingUpsertStmt = db.prepare(`
  INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

export function getSetting(key) {
  return settingGetStmt.get(key)?.value ?? null;
}

export function getEffectiveInactivityDays() {
  const v = Number(getSetting('default_inactivity_days') ?? DEFAULT_INACTIVITY_DAYS_ENV);
  return Number.isFinite(v) && v >= 1 ? v : DEFAULT_INACTIVITY_DAYS_ENV;
}

export function getEffectiveSyncIntervalMinutes() {
  const v = Number(getSetting('sync_interval_minutes') ?? SYNC_INTERVAL_MINUTES_ENV);
  return Number.isFinite(v) && v >= 1 ? v : SYNC_INTERVAL_MINUTES_ENV;
}

export function getEffectiveOwners() {
  const stored = getSetting('github_owners');
  return stored !== null ? parseOwners(stored) : parseOwners(process.env.GITHUB_OWNERS);
}
