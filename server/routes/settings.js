import { Router } from 'express';
import db from '../db.js';
import { parseOwners } from '../github.js';
import {
  getSetting, settingUpsertStmt,
  getEffectiveInactivityDays, getEffectiveSyncIntervalMinutes, getEffectiveOwners,
  DEFAULT_INACTIVITY_DAYS_ENV, SYNC_INTERVAL_MINUTES_ENV,
  ALLOWED_SETTING_KEYS,
} from '../lib/settings.js';
import { queueRefresh, restartSyncInterval } from '../lib/sync.js';
import { invalidatePayloadCache } from '../lib/payloadCache.js';

const router = Router();

// ---- App settings ----------------------------------------------------------
router.get('/settings', (req, res) => {
  res.json({
    settings: {
      defaultInactivityDays: getEffectiveInactivityDays(),
      syncIntervalMinutes: getEffectiveSyncIntervalMinutes(),
      githubOwners: getEffectiveOwners().join(', '),
    },
    defaults: {
      defaultInactivityDays: DEFAULT_INACTIVITY_DAYS_ENV,
      syncIntervalMinutes: SYNC_INTERVAL_MINUTES_ENV,
      githubOwners: parseOwners(process.env.GITHUB_OWNERS).join(', '),
    },
  });
});

router.put('/settings', (req, res) => {
  const body = req.body || {};
  const errors = [];

  if ('defaultInactivityDays' in body) {
    const v = Number(body.defaultInactivityDays);
    if (!Number.isFinite(v) || v < 1 || v > 365) {
      errors.push('defaultInactivityDays must be an integer between 1 and 365');
    }
  }
  if ('syncIntervalMinutes' in body) {
    const v = Number(body.syncIntervalMinutes);
    if (!Number.isFinite(v) || v < 1 || v > 1440) {
      errors.push('syncIntervalMinutes must be an integer between 1 and 1440');
    }
  }
  if (errors.length) return res.status(400).json({ errors });

  const now = new Date().toISOString();
  const prevOwners = getEffectiveOwners().join(',');

  for (const key of ALLOWED_SETTING_KEYS) {
    if (!(key in body)) continue;
    let dbKey;
    if (key === 'defaultInactivityDays') dbKey = 'default_inactivity_days';
    else if (key === 'syncIntervalMinutes') dbKey = 'sync_interval_minutes';
    else dbKey = 'github_owners';
    settingUpsertStmt.run(dbKey, String(body[key] ?? ''), now);
  }

  if ('syncIntervalMinutes' in body) {
    restartSyncInterval(getEffectiveSyncIntervalMinutes());
  }

  const ownersChanged = 'githubOwners' in body &&
    parseOwners(body.githubOwners).join(',') !== prevOwners;
  if (ownersChanged) queueRefresh();

  invalidatePayloadCache();
  res.json({ ok: true, resyncing: ownersChanged });
});

// ---- User preferences ------------------------------------------------------
// Stores view/display prefs (density, sort, view, groupBy, fields, filters,
// showIgnored) as a single JSON blob. Read once on client mount to hydrate
// prefs across sessions/devices; written back on every change.
const PREFS_KEY = 'board';
const getPrefsStmt = db.prepare(`SELECT value FROM prefs WHERE key = ?`);
const putPrefsStmt = db.prepare(`
  INSERT INTO prefs (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);
const ALLOWED_PREF_KEYS = new Set(['density', 'sort', 'view', 'groupBy', 'fields', 'filters', 'showIgnored']);

router.get('/prefs', (req, res) => {
  const row = getPrefsStmt.get(PREFS_KEY);
  if (!row) return res.json({ prefs: null });
  try {
    res.json({ prefs: JSON.parse(row.value) });
  } catch {
    res.json({ prefs: null });
  }
});

router.put('/prefs', (req, res) => {
  const body = req.body || {};
  const prefs = {};
  for (const k of ALLOWED_PREF_KEYS) {
    if (k in body) prefs[k] = body[k];
  }
  putPrefsStmt.run(PREFS_KEY, JSON.stringify(prefs), new Date().toISOString());
  res.json({ ok: true });
});

export default router;
