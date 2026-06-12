import { Router } from 'express';
import db from '../db.js';
import { rateLimit, sourceStatus, authStatus } from '../github.js';
import { buildReport, toMarkdown, toCsv, REPORT_KINDS } from '../report.js';
import { repoCache, cacheReady, syncing, lastFetch, lastError, findRepo } from '../lib/sync.js';
import { buildPayload } from '../lib/payload.js';
import { invalidatePayloadCache } from '../lib/payloadCache.js';
import { getEffectiveInactivityDays, getEffectiveOwners } from '../lib/settings.js';

const router = Router();
const STARTED_AT = Date.now();

// ---- Prepared statements ---------------------------------------------------
// Priority is an independent axis (1=high, 2=medium, 3=low, null=none):
// touches ONLY the priority column, never the scheduling anchor.
const setPriorityStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority, updated_at)
  VALUES (@id, @full_name, @priority, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    priority = excluded.priority,
    updated_at = excluded.updated_at
`);
// Scheduling is independent of priority: sets the anchor + optionally checked_at.
const setCheckedStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority_set_at, checked_at, updated_at)
  VALUES (@id, @full_name, @set_at, @checked_at, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    priority_set_at = excluded.priority_set_at,
    checked_at = COALESCE(excluded.checked_at, repo_state.checked_at),
    snooze_until = NULL,
    updated_at = excluded.updated_at
`);
const clearScheduleStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority_set_at, checked_at, updated_at)
  VALUES (@id, @full_name, NULL, NULL, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    priority_set_at = NULL,
    checked_at = NULL,
    snooze_until = NULL,
    updated_at = excluded.updated_at
`);
const restoreScheduleStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority_set_at, checked_at, updated_at)
  VALUES (@id, @full_name, @priority_set_at, @checked_at, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    priority_set_at = excluded.priority_set_at,
    checked_at = excluded.checked_at,
    updated_at = excluded.updated_at
`);
const getInactivityStmt = db.prepare('SELECT inactivity_days FROM repo_state WHERE repo_id = ?');
const touchStmt = db.prepare(`UPDATE repo_state SET priority_set_at = ?, checked_at = ?, snooze_until = NULL, updated_at = ? WHERE repo_id = ?`);
const inactivityStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, inactivity_days, updated_at)
  VALUES (@id, @full_name, @days, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    inactivity_days = excluded.inactivity_days,
    updated_at = excluded.updated_at
`);
const snoozeStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, snooze_until, checked_at, updated_at)
  VALUES (@id, @full_name, @snooze_until, @checked_at, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    snooze_until = excluded.snooze_until,
    checked_at   = excluded.checked_at,
    updated_at   = excluded.updated_at
`);
const positionStmt = db.prepare(`UPDATE repo_state SET position = ?, updated_at = ? WHERE repo_id = ?`);
const setIgnoredStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, ignored, updated_at)
  VALUES (@id, @full_name, @ignored, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    ignored = excluded.ignored,
    updated_at = excluded.updated_at
`);
const addNoticeStmt = db.prepare(`
  INSERT INTO repo_notice (repo_id, full_name, body, created_at)
  VALUES (@id, @full_name, @body, @created_at)
`);
const noticesForRepoStmt = db.prepare(
  `SELECT id, repo_id, full_name, body, created_at FROM repo_notice WHERE repo_id = ? ORDER BY id DESC`
);
const deleteNoticeStmt = db.prepare(`DELETE FROM repo_notice WHERE id = ?`);
const addTagStmt = db.prepare(`
  INSERT OR IGNORE INTO repo_tag (repo_id, full_name, tag, created_at)
  VALUES (@id, @full_name, @tag, @now)
`);
const removeTagStmt = db.prepare('DELETE FROM repo_tag WHERE repo_id = ? AND tag = ?');
const deleteTagEverywhereStmt = db.prepare('DELETE FROM repo_tag WHERE tag = ?');
const tagsForRepoStmt = db.prepare('SELECT tag FROM repo_tag WHERE repo_id = ? ORDER BY tag');
const allTagsStmt = db.prepare('SELECT tag, COUNT(*) AS count FROM repo_tag GROUP BY tag ORDER BY count DESC, tag ASC');
const addFlagStmt = db.prepare(`
  INSERT OR IGNORE INTO repo_flag (repo_id, full_name, flag, created_at)
  VALUES (@id, @full_name, @flag, @now)
`);
const removeFlagStmt = db.prepare('DELETE FROM repo_flag WHERE repo_id = ? AND flag = ?');
const flagsForRepoStmt = db.prepare('SELECT flag FROM repo_flag WHERE repo_id = ? ORDER BY flag');
const restoreStateStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority, priority_set_at, checked_at, inactivity_days, position, ignored, snooze_until, updated_at)
  VALUES (@repo_id, @full_name, @priority, @priority_set_at, @checked_at, @inactivity_days, @position, @ignored, @snooze_until, @updated_at)
`);
const restoreNoticeStmt = db.prepare(
  `INSERT INTO repo_notice (repo_id, full_name, body, created_at) VALUES (@repo_id, @full_name, @body, @created_at)`
);
const restoreTagStmt = db.prepare(
  `INSERT OR IGNORE INTO repo_tag (repo_id, full_name, tag, created_at) VALUES (@repo_id, @full_name, @tag, @created_at)`
);
const restoreFlagStmt = db.prepare(
  `INSERT OR IGNORE INTO repo_flag (repo_id, full_name, flag, created_at) VALUES (@repo_id, @full_name, @flag, @created_at)`
);

const normalizeTag = (raw) => (typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 50) : '');

// ---- Health ----------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cacheReady,
    syncing,
    repoCount: repoCache.length,
    lastFetch,
    lastError,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
  });
});

// ---- Board -----------------------------------------------------------------
router.get('/repos', (req, res) => {
  if (!cacheReady) {
    console.log('[/api/repos] cache not ready yet — GitHub fetch still in progress');
  }
  res.json({
    repos: buildPayload(),
    cacheReady,
    syncing,
    lastFetch,
    lastError,
    defaultInactivityDays: getEffectiveInactivityDays(),
    owners: getEffectiveOwners(),
    sourceWarnings: [...sourceStatus.warnings],
    tokenPresent: authStatus.present || Boolean(process.env.GITHUB_TOKEN),
    authSource: authStatus.source,
    rateLimit: { ...rateLimit },
  });
});

// ---- Repo mutations --------------------------------------------------------
router.post('/repos/:id/priority', (req, res) => {
  const id = Number(req.params.id);
  const { priority } = req.body;
  if (priority !== null && ![1, 2, 3].includes(priority)) {
    return res.status(400).json({ error: 'priority must be 1, 2, 3 or null' });
  }
  const now = new Date().toISOString();
  setPriorityStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, priority, now });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post('/repos/:id/clear', (req, res) => {
  const id = Number(req.params.id);
  const now = new Date().toISOString();
  clearScheduleStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, now });
  invalidatePayloadCache();
  res.json({ ok: true });
});

// Restore a snapshotted scheduling state (undo "Clear check date").
router.post('/repos/:id/state', (req, res) => {
  const id = Number(req.params.id);
  const { priority_set_at = null, checked_at = null } = req.body || {};
  const now = new Date().toISOString();
  restoreScheduleStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, priority_set_at, checked_at, now });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post('/repos/:id/check', (req, res) => {
  const id = Number(req.params.id);
  let { daysAgo } = req.body || {};
  daysAgo = Number(daysAgo ?? 0);
  if (!Number.isFinite(daysAgo) || daysAgo < 0) {
    return res.status(400).json({ error: 'daysAgo must be a non-negative number' });
  }

  const now = new Date();
  const anchorAt = new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const nowIso = now.toISOString();

  // daysAgo below the review interval → card lands in a future column (real review).
  // daysAgo >= interval → card returns to Today ("make due") → leave checked_at untouched.
  const effectiveInactivity = getInactivityStmt.get(id)?.inactivity_days ?? getEffectiveInactivityDays();
  const isReview = daysAgo < effectiveInactivity;

  setCheckedStmt.run({
    id,
    full_name: findRepo(id)?.full_name ?? null,
    set_at: anchorAt,
    checked_at: isReview ? nowIso : null,
    now: nowIso,
  });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post('/repos/:id/touch', (req, res) => {
  const now = new Date().toISOString();
  touchStmt.run(now, now, now, Number(req.params.id));
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post('/repos/:id/inactivity', (req, res) => {
  const id = Number(req.params.id);
  let { days } = req.body;
  if (days !== null) {
    days = Number(days);
    if (!Number.isFinite(days) || days < 0) return res.status(400).json({ error: 'days must be a non-negative number or null' });
  }
  inactivityStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, days, now: new Date().toISOString() });
  invalidatePayloadCache();
  res.json({ ok: true });
});

// One-off snooze: resurface in exactly N days without changing review cadence.
// Cleared on any subsequent check, touch, or clear.
router.post('/repos/:id/snooze', (req, res) => {
  const id = Number(req.params.id);
  let { days } = req.body || {};
  days = Number(days ?? 0);
  if (!Number.isFinite(days) || days <= 0) {
    return res.status(400).json({ error: 'days must be a positive number' });
  }
  const now = new Date();
  const snoozeUntil = new Date(now.getTime() + days * 86400000).toISOString();
  const nowIso = now.toISOString();
  snoozeStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, snooze_until: snoozeUntil, checked_at: nowIso, now: nowIso });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post('/repos/:id/ignore', (req, res) => {
  const id = Number(req.params.id);
  const { ignored } = req.body || {};
  if (typeof ignored !== 'boolean') return res.status(400).json({ error: 'ignored must be a boolean' });
  setIgnoredStmt.run({
    id,
    full_name: findRepo(id)?.full_name ?? null,
    ignored: ignored ? 1 : 0,
    now: new Date().toISOString(),
  });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post('/reorder', (req, res) => {
  const { orderedIds } = req.body || {};
  const now = new Date().toISOString();
  const tx = db.transaction((ids) => ids.forEach((id, i) => positionStmt.run(i, now, Number(id))));
  tx(Array.isArray(orderedIds) ? orderedIds : []);
  invalidatePayloadCache();
  res.json({ ok: true });
});

// ---- Notices ---------------------------------------------------------------
router.post('/repos/:id/notices', (req, res) => {
  const id = Number(req.params.id);
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'body must be a non-empty string' });
  const now = new Date().toISOString();
  const created_at = typeof req.body?.created_at === 'string' ? req.body.created_at : now;
  const info = addNoticeStmt.run({
    id,
    full_name: findRepo(id)?.full_name ?? null,
    body,
    created_at,
  });
  invalidatePayloadCache();
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.get('/repos/:id/notices', (req, res) => {
  res.json({ notices: noticesForRepoStmt.all(Number(req.params.id)) });
});

router.get('/notices', (req, res) => {
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
  const orderBy =
    req.query.sort === 'repo' ? `full_name ${dir}, created_at ${dir}` : `created_at ${dir}, id ${dir}`;
  const notices = db
    .prepare(`SELECT id, repo_id, full_name, body, created_at FROM repo_notice ORDER BY ${orderBy}`)
    .all();
  res.json({ notices });
});

router.delete('/notices/:noticeId', (req, res) => {
  deleteNoticeStmt.run(Number(req.params.noticeId));
  invalidatePayloadCache();
  res.json({ ok: true });
});

// ---- Tags ------------------------------------------------------------------
router.get('/repos/:id/tags', (req, res) => {
  res.json({ tags: tagsForRepoStmt.all(Number(req.params.id)).map((r) => r.tag) });
});

router.post('/repos/:id/tags', (req, res) => {
  const id = Number(req.params.id);
  const tag = normalizeTag(req.body?.tag);
  if (!tag) return res.status(400).json({ error: 'tag must be a non-empty string' });
  addTagStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, tag, now: new Date().toISOString() });
  invalidatePayloadCache();
  res.json({ ok: true, tag });
});

router.delete('/repos/:id/tags/:tag', (req, res) => {
  removeTagStmt.run(Number(req.params.id), normalizeTag(req.params.tag));
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.get('/tags', (req, res) => {
  res.json({ tags: allTagsStmt.all() });
});

router.delete('/tags/:tag', (req, res) => {
  const info = deleteTagEverywhereStmt.run(normalizeTag(req.params.tag));
  invalidatePayloadCache();
  res.json({ ok: true, removed: info.changes });
});

// ---- Flags -----------------------------------------------------------------
router.get('/repos/:id/flags', (req, res) => {
  res.json({ flags: flagsForRepoStmt.all(Number(req.params.id)).map((r) => r.flag) });
});

router.post('/repos/:id/flags', (req, res) => {
  const id = Number(req.params.id);
  const flag = normalizeTag(req.body?.flag);
  if (!flag) return res.status(400).json({ error: 'flag must be a non-empty string' });
  addFlagStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, flag, now: new Date().toISOString() });
  invalidatePayloadCache();
  res.json({ ok: true, flag });
});

router.delete('/repos/:id/flags/:flag', (req, res) => {
  removeFlagStmt.run(Number(req.params.id), normalizeTag(req.params.flag));
  invalidatePayloadCache();
  res.json({ ok: true });
});

// ---- Reports ---------------------------------------------------------------
router.get('/reports', (req, res) => {
  res.json({ kinds: REPORT_KINDS });
});

router.get('/reports/:kind', (req, res) => {
  let report;
  try {
    report = buildReport(req.params.kind, buildPayload(), { days: req.query.days });
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
  const format = req.query.format;
  if (format === 'md' || format === 'markdown') return res.type('text/markdown').send(toMarkdown(report));
  if (format === 'csv') return res.type('text/csv').send(toCsv(report));
  res.json(report);
});

// ---- Backup / restore ------------------------------------------------------
const BACKUP_VERSION = 1;
router.get('/backup', (req, res) => {
  res.json({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    repo_state: db.prepare('SELECT * FROM repo_state').all(),
    repo_notice: db.prepare('SELECT repo_id, full_name, body, created_at FROM repo_notice').all(),
    repo_tag: db.prepare('SELECT repo_id, full_name, tag, created_at FROM repo_tag').all(),
    repo_flag: db.prepare('SELECT repo_id, full_name, flag, created_at FROM repo_flag').all(),
  });
});

router.post('/restore', (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.repo_state) || !Array.isArray(body.repo_notice) || !Array.isArray(body.repo_tag)) {
    return res.status(400).json({ error: 'invalid backup: repo_state, repo_notice and repo_tag arrays are required' });
  }
  const now = new Date().toISOString();
  try {
    const restore = db.transaction(() => {
      db.prepare('DELETE FROM repo_state').run();
      db.prepare('DELETE FROM repo_notice').run();
      db.prepare('DELETE FROM repo_tag').run();
      for (const s of body.repo_state) {
        if (s.repo_id == null) continue;
        restoreStateStmt.run({
          repo_id: s.repo_id,
          full_name: s.full_name ?? null,
          priority: s.priority ?? null,
          priority_set_at: s.priority_set_at ?? null,
          checked_at: s.checked_at ?? null,
          inactivity_days: s.inactivity_days ?? null,
          position: s.position ?? 0,
          ignored: s.ignored ? 1 : 0,
          snooze_until: s.snooze_until ?? null,
          updated_at: s.updated_at ?? now,
        });
      }
      for (const n of body.repo_notice) {
        if (n.repo_id == null || !n.body) continue;
        restoreNoticeStmt.run({ repo_id: n.repo_id, full_name: n.full_name ?? null, body: n.body, created_at: n.created_at ?? now });
      }
      for (const t of body.repo_tag) {
        if (t.repo_id == null || !t.tag) continue;
        restoreTagStmt.run({ repo_id: t.repo_id, full_name: t.full_name ?? null, tag: normalizeTag(t.tag), created_at: t.created_at ?? now });
      }
      db.prepare('DELETE FROM repo_flag').run();
      for (const f of (body.repo_flag || [])) {
        if (f.repo_id == null || !f.flag) continue;
        restoreFlagStmt.run({ repo_id: f.repo_id, full_name: f.full_name ?? null, flag: normalizeTag(f.flag), created_at: f.created_at ?? now });
      }
    });
    restore();
  } catch (e) {
    return res.status(400).json({ error: `restore failed: ${String(e.message || e)}` });
  }
  invalidatePayloadCache();
  res.json({
    ok: true,
    restored: {
      repo_state: body.repo_state.length,
      repo_notice: body.repo_notice.length,
      repo_tag: body.repo_tag.length,
      repo_flag: (body.repo_flag || []).length,
    },
  });
});

export default router;
