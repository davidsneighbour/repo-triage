import { Router } from "express";
import db from "../db.js";
import { authStatus, rateLimit, sourceStatus } from "../github.js";
import { getAllActivity, logActivity } from "../lib/activity.js";
import { buildPayload } from "../lib/payload.js";
import { invalidatePayloadCache } from "../lib/payloadCache.js";
import { getLastExport } from "../lib/reportSchedule.js";
import {
  getEffectiveInactivityDays,
  getEffectiveOwners,
} from "../lib/settings.js";
import {
  cacheReady,
  findRepo,
  lastError,
  lastFetch,
  repoCache,
  syncing,
} from "../lib/sync.js";
import { buildReport, REPORT_KINDS, toCsv, toMarkdown } from "../report.js";

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
const getInactivityStmt = db.prepare(
  "SELECT inactivity_days FROM repo_state WHERE repo_id = ?",
);
const touchStmt = db.prepare(
  `UPDATE repo_state SET priority_set_at = ?, checked_at = ?, snooze_until = NULL, updated_at = ? WHERE repo_id = ?`,
);
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
const positionStmt = db.prepare(
  `UPDATE repo_state SET position = ?, updated_at = ? WHERE repo_id = ?`,
);
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
  `SELECT id, repo_id, full_name, body, created_at FROM repo_notice WHERE repo_id = ? ORDER BY id DESC`,
);
const deleteNoticeStmt = db.prepare(`DELETE FROM repo_notice WHERE id = ?`);
const addTagStmt = db.prepare(`
  INSERT OR IGNORE INTO repo_tag (repo_id, full_name, tag, created_at)
  VALUES (@id, @full_name, @tag, @now)
`);
const removeTagStmt = db.prepare(
  "DELETE FROM repo_tag WHERE repo_id = ? AND tag = ?",
);
const deleteTagEverywhereStmt = db.prepare(
  "DELETE FROM repo_tag WHERE tag = ?",
);
const tagsForRepoStmt = db.prepare(
  "SELECT tag FROM repo_tag WHERE repo_id = ? ORDER BY tag",
);
const allTagsStmt = db.prepare(`
  SELECT r.tag AS tag, COUNT(t.repo_id) AS count
  FROM tag_registry r
  LEFT JOIN repo_tag t ON t.tag = r.tag
  GROUP BY r.tag
  ORDER BY count DESC, r.tag ASC
`);
const registerTagStmt = db.prepare(
  `INSERT OR IGNORE INTO tag_registry (tag, created_at) VALUES (?, ?)`,
);
const unregisterTagStmt = db.prepare("DELETE FROM tag_registry WHERE tag = ?");
const tagRegisteredStmt = db.prepare(
  "SELECT 1 FROM tag_registry WHERE tag = ?",
);
const repoIdsForTagStmt = db.prepare(
  "SELECT DISTINCT repo_id FROM repo_tag WHERE tag = ?",
);
const mergeTagStmt = db.prepare(`
  INSERT OR IGNORE INTO repo_tag (repo_id, full_name, tag, created_at)
  SELECT repo_id, full_name, ?, created_at FROM repo_tag WHERE tag = ?
`);
const mergeTagRuleStmt = db.prepare(`
  INSERT OR IGNORE INTO tag_rule (tag, days, updated_at)
  SELECT ?, days, updated_at FROM tag_rule WHERE tag = ?
`);
const deleteTagRuleStmt = db.prepare("DELETE FROM tag_rule WHERE tag = ?");
const addFlagStmt = db.prepare(`
  INSERT OR IGNORE INTO repo_flag (repo_id, full_name, flag, created_at)
  VALUES (@id, @full_name, @flag, @now)
`);
const removeFlagStmt = db.prepare(
  "DELETE FROM repo_flag WHERE repo_id = ? AND flag = ?",
);
const flagsForRepoStmt = db.prepare(
  "SELECT flag FROM repo_flag WHERE repo_id = ? ORDER BY flag",
);
const restoreStateStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority, priority_set_at, checked_at, inactivity_days, position, ignored, snooze_until, updated_at)
  VALUES (@repo_id, @full_name, @priority, @priority_set_at, @checked_at, @inactivity_days, @position, @ignored, @snooze_until, @updated_at)
`);
const restoreNoticeStmt = db.prepare(
  `INSERT INTO repo_notice (repo_id, full_name, body, created_at) VALUES (@repo_id, @full_name, @body, @created_at)`,
);
const restoreTagStmt = db.prepare(
  `INSERT OR IGNORE INTO repo_tag (repo_id, full_name, tag, created_at) VALUES (@repo_id, @full_name, @tag, @created_at)`,
);
const restoreFlagStmt = db.prepare(
  `INSERT OR IGNORE INTO repo_flag (repo_id, full_name, flag, created_at) VALUES (@repo_id, @full_name, @flag, @created_at)`,
);
const restoreTagRegistryStmt = db.prepare(
  `INSERT OR IGNORE INTO tag_registry (tag, created_at) VALUES (@tag, @created_at)`,
);

const normalizeTag = (raw) =>
  typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 50) : "";

// ---- Health ----------------------------------------------------------------
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    cacheReady,
    syncing,
    repoCount: repoCache.length,
    lastFetch,
    lastError,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    schemaVersion: db.pragma("user_version", { simple: true }),
  });
});

// ---- Board -----------------------------------------------------------------
router.get("/repos", (req, res) => {
  if (!cacheReady) {
    console.log(
      "[/api/repos] cache not ready yet — GitHub fetch still in progress",
    );
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

// ---- Activity log ----------------------------------------------------------
const activityStmt = db.prepare(
  `SELECT id, action, detail, created_at FROM activity_log WHERE repo_id = ? ORDER BY id DESC LIMIT 50`,
);
router.get("/repos/:id/activity", (req, res) => {
  const rows = activityStmt.all(Number(req.params.id));
  res.json({
    activity: rows.map((r) => ({
      ...r,
      detail: r.detail ? JSON.parse(r.detail) : null,
    })),
  });
});

// Cross-repo event log (#78): every tracked repo's activity in one feed,
// most recent first. Read-only — never triggers a GitHub sync.
router.get("/activity", (req, res) => {
  res.json({ activity: getAllActivity() });
});

// ---- Bulk mutations --------------------------------------------------------
const BULK_ACTIONS = [
  "ignore",
  "unignore",
  "check",
  "touch",
  "clear",
  "priority",
  "tag",
  "untag",
];

router.post("/repos/bulk", (req, res) => {
  const { action, ids, ...params } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids must be a non-empty array" });
  }
  if (!BULK_ACTIONS.includes(action)) {
    return res
      .status(400)
      .json({ error: `action must be one of: ${BULK_ACTIONS.join(", ")}` });
  }
  const now = new Date();
  const nowIso = now.toISOString();
  try {
    db.transaction(() => {
      for (const rawId of ids) {
        const id = Number(rawId);
        const repo = findRepo(id);
        switch (action) {
          case "ignore":
          case "unignore": {
            const ignored = action === "ignore";
            setIgnoredStmt.run({
              id,
              full_name: repo?.full_name ?? null,
              ignored: ignored ? 1 : 0,
              now: nowIso,
            });
            logActivity(id, repo?.full_name ?? "", "ignore", { ignored });
            break;
          }
          case "check": {
            const daysAgo = Number(params.daysAgo ?? 0);
            const anchorAt = new Date(
              now.getTime() - daysAgo * 86400000,
            ).toISOString();
            const effectiveInactivity =
              getInactivityStmt.get(id)?.inactivity_days ??
              getEffectiveInactivityDays();
            const isReview = daysAgo < effectiveInactivity;
            setCheckedStmt.run({
              id,
              full_name: repo?.full_name ?? null,
              set_at: anchorAt,
              checked_at: isReview ? nowIso : null,
              now: nowIso,
            });
            logActivity(id, repo?.full_name ?? "", "check", { daysAgo });
            break;
          }
          case "touch": {
            touchStmt.run(nowIso, nowIso, nowIso, id);
            logActivity(id, repo?.full_name ?? "", "touch");
            break;
          }
          case "clear": {
            clearScheduleStmt.run({
              id,
              full_name: repo?.full_name ?? null,
              now: nowIso,
            });
            logActivity(id, repo?.full_name ?? "", "clear");
            break;
          }
          case "priority": {
            const priority =
              params.priority !== undefined ? params.priority : null;
            if (priority !== null && ![1, 2, 3].includes(priority))
              throw new Error("invalid priority value");
            setPriorityStmt.run({
              id,
              full_name: repo?.full_name ?? null,
              priority,
              now: nowIso,
            });
            logActivity(id, repo?.full_name ?? "", "priority", { priority });
            break;
          }
          case "tag": {
            const tag = normalizeTag(params.tag);
            if (!tag) throw new Error("tag must be non-empty");
            registerTagStmt.run(tag, nowIso);
            addTagStmt.run({
              id,
              full_name: repo?.full_name ?? null,
              tag,
              now: nowIso,
            });
            logActivity(id, repo?.full_name ?? "", "tag_add", { tag });
            break;
          }
          case "untag": {
            const tag = normalizeTag(params.tag);
            if (!tag) throw new Error("tag must be non-empty");
            removeTagStmt.run(id, tag);
            logActivity(id, repo?.full_name ?? "", "tag_remove", { tag });
            break;
          }
        }
      }
    })();
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
  invalidatePayloadCache();
  res.json({ ok: true, count: ids.length });
});

// ---- Repo mutations --------------------------------------------------------
router.post("/repos/:id/priority", (req, res) => {
  const id = Number(req.params.id);
  const { priority } = req.body;
  if (priority !== null && ![1, 2, 3].includes(priority)) {
    return res.status(400).json({ error: "priority must be 1, 2, 3 or null" });
  }
  const now = new Date().toISOString();
  const repo = findRepo(id);
  setPriorityStmt.run({
    id,
    full_name: repo?.full_name ?? null,
    priority,
    now,
  });
  logActivity(id, repo?.full_name ?? "", "priority", { priority });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post("/repos/:id/clear", (req, res) => {
  const id = Number(req.params.id);
  const now = new Date().toISOString();
  const repo = findRepo(id);
  clearScheduleStmt.run({ id, full_name: repo?.full_name ?? null, now });
  logActivity(id, repo?.full_name ?? "", "clear");
  invalidatePayloadCache();
  res.json({ ok: true });
});

// Restore a snapshotted scheduling state (undo "Clear check date").
router.post("/repos/:id/state", (req, res) => {
  const id = Number(req.params.id);
  const { priority_set_at = null, checked_at = null } = req.body || {};
  const now = new Date().toISOString();
  const repo = findRepo(id);
  restoreScheduleStmt.run({
    id,
    full_name: repo?.full_name ?? null,
    priority_set_at,
    checked_at,
    now,
  });
  logActivity(id, repo?.full_name ?? "", "state", {
    priority_set_at,
    checked_at,
  });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post("/repos/:id/check", (req, res) => {
  const id = Number(req.params.id);
  let { daysAgo } = req.body || {};
  daysAgo = Number(daysAgo ?? 0);
  if (!Number.isFinite(daysAgo) || daysAgo < 0) {
    return res
      .status(400)
      .json({ error: "daysAgo must be a non-negative number" });
  }

  const now = new Date();
  const anchorAt = new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const nowIso = now.toISOString();

  // daysAgo below the review interval → card lands in a future column (real review).
  // daysAgo >= interval → card returns to Today ("make due") → leave checked_at untouched.
  const effectiveInactivity =
    getInactivityStmt.get(id)?.inactivity_days ?? getEffectiveInactivityDays();
  const isReview = daysAgo < effectiveInactivity;
  const repo = findRepo(id);

  setCheckedStmt.run({
    id,
    full_name: repo?.full_name ?? null,
    set_at: anchorAt,
    checked_at: isReview ? nowIso : null,
    now: nowIso,
  });
  logActivity(id, repo?.full_name ?? "", "check", { daysAgo });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post("/repos/:id/touch", (req, res) => {
  const id = Number(req.params.id);
  const now = new Date().toISOString();
  touchStmt.run(now, now, now, id);
  logActivity(id, findRepo(id)?.full_name ?? "", "touch");
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post("/repos/:id/inactivity", (req, res) => {
  const id = Number(req.params.id);
  let { days } = req.body;
  if (days !== null) {
    days = Number(days);
    if (!Number.isFinite(days) || days < 0)
      return res
        .status(400)
        .json({ error: "days must be a non-negative number or null" });
  }
  const repo = findRepo(id);
  inactivityStmt.run({
    id,
    full_name: repo?.full_name ?? null,
    days,
    now: new Date().toISOString(),
  });
  logActivity(id, repo?.full_name ?? "", "inactivity", { days });
  invalidatePayloadCache();
  res.json({ ok: true });
});

// One-off snooze: resurface in exactly N days without changing review cadence.
// Cleared on any subsequent check, touch, or clear.
router.post("/repos/:id/snooze", (req, res) => {
  const id = Number(req.params.id);
  let { days } = req.body || {};
  days = Number(days ?? 0);
  if (!Number.isFinite(days) || days <= 0) {
    return res.status(400).json({ error: "days must be a positive number" });
  }
  const now = new Date();
  const snoozeUntil = new Date(now.getTime() + days * 86400000).toISOString();
  const nowIso = now.toISOString();
  const repo = findRepo(id);
  snoozeStmt.run({
    id,
    full_name: repo?.full_name ?? null,
    snooze_until: snoozeUntil,
    checked_at: nowIso,
    now: nowIso,
  });
  logActivity(id, repo?.full_name ?? "", "snooze", { days });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post("/repos/:id/ignore", (req, res) => {
  const id = Number(req.params.id);
  const { ignored } = req.body || {};
  if (typeof ignored !== "boolean")
    return res.status(400).json({ error: "ignored must be a boolean" });
  const repo = findRepo(id);
  setIgnoredStmt.run({
    id,
    full_name: repo?.full_name ?? null,
    ignored: ignored ? 1 : 0,
    now: new Date().toISOString(),
  });
  logActivity(id, repo?.full_name ?? "", "ignore", { ignored });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.post("/reorder", (req, res) => {
  const { orderedIds } = req.body || {};
  const now = new Date().toISOString();
  const tx = db.transaction((ids) =>
    ids.forEach((id, i) => positionStmt.run(i, now, Number(id))),
  );
  tx(Array.isArray(orderedIds) ? orderedIds : []);
  invalidatePayloadCache();
  res.json({ ok: true });
});

// ---- Notices ---------------------------------------------------------------
router.post("/repos/:id/notices", (req, res) => {
  const id = Number(req.params.id);
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body)
    return res.status(400).json({ error: "body must be a non-empty string" });
  const now = new Date().toISOString();
  const created_at =
    typeof req.body?.created_at === "string" ? req.body.created_at : now;
  const repo = findRepo(id);
  const info = addNoticeStmt.run({
    id,
    full_name: repo?.full_name ?? null,
    body,
    created_at,
  });
  logActivity(id, repo?.full_name ?? "", "notice_add", { body });
  invalidatePayloadCache();
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.get("/repos/:id/notices", (req, res) => {
  res.json({ notices: noticesForRepoStmt.all(Number(req.params.id)) });
});

router.get("/notices", (req, res) => {
  const dir = req.query.dir === "asc" ? "ASC" : "DESC";
  const orderBy =
    req.query.sort === "repo"
      ? `full_name ${dir}, created_at ${dir}`
      : `created_at ${dir}, id ${dir}`;
  const notices = db
    .prepare(
      `SELECT id, repo_id, full_name, body, created_at FROM repo_notice ORDER BY ${orderBy}`,
    )
    .all();
  res.json({ notices });
});

const noticeByIdStmt = db.prepare(
  "SELECT repo_id, full_name FROM repo_notice WHERE id = ?",
);
router.delete("/notices/:noticeId", (req, res) => {
  const noticeId = Number(req.params.noticeId);
  const notice = noticeByIdStmt.get(noticeId);
  deleteNoticeStmt.run(noticeId);
  if (notice)
    logActivity(notice.repo_id, notice.full_name ?? "", "notice_delete", {
      notice_id: noticeId,
    });
  invalidatePayloadCache();
  res.json({ ok: true });
});

// ---- Tags ------------------------------------------------------------------
router.get("/repos/:id/tags", (req, res) => {
  res.json({
    tags: tagsForRepoStmt.all(Number(req.params.id)).map((r) => r.tag),
  });
});

router.post("/repos/:id/tags", (req, res) => {
  const id = Number(req.params.id);
  const tag = normalizeTag(req.body?.tag);
  if (!tag)
    return res.status(400).json({ error: "tag must be a non-empty string" });
  const repo = findRepo(id);
  const now = new Date().toISOString();
  registerTagStmt.run(tag, now);
  addTagStmt.run({ id, full_name: repo?.full_name ?? null, tag, now });
  logActivity(id, repo?.full_name ?? "", "tag_add", { tag });
  invalidatePayloadCache();
  res.json({ ok: true, tag });
});

router.delete("/repos/:id/tags/:tag", (req, res) => {
  const id = Number(req.params.id);
  const tag = normalizeTag(req.params.tag);
  removeTagStmt.run(id, tag);
  logActivity(id, findRepo(id)?.full_name ?? "", "tag_remove", { tag });
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.get("/tags", (req, res) => {
  res.json({ tags: allTagsStmt.all() });
});

// Create a tag in the registry without attaching it to any repo yet
// (repo_tag.repo_id is NOT NULL, so a tag can't exist there on its own).
router.post("/tags", (req, res) => {
  const tag = normalizeTag(req.body?.tag);
  if (!tag)
    return res.status(400).json({ error: "tag must be a non-empty string" });
  registerTagStmt.run(tag, new Date().toISOString());
  invalidatePayloadCache();
  res.json({ ok: true, tag });
});

router.put("/tags/:tag", (req, res) => {
  const from = normalizeTag(req.params.tag);
  const to = normalizeTag(req.body?.newTag);
  if (!to)
    return res.status(400).json({ error: "newTag must be a non-empty string" });
  if (!tagRegisteredStmt.get(from))
    return res.status(404).json({ error: `tag "${from}" not found` });
  if (from === to) return res.json({ ok: true, tag: to, merged: false });

  const now = new Date().toISOString();
  const merged = Boolean(tagRegisteredStmt.get(to));
  db.transaction(() => {
    mergeTagStmt.run(to, from);
    deleteTagEverywhereStmt.run(from);
    mergeTagRuleStmt.run(to, from);
    deleteTagRuleStmt.run(from);
    registerTagStmt.run(to, now);
    unregisterTagStmt.run(from);
  })();
  invalidatePayloadCache();
  res.json({ ok: true, tag: to, merged });
});

router.delete("/tags/:tag", (req, res) => {
  const tag = normalizeTag(req.params.tag);
  const resetCheck =
    req.query.resetCheck === "true" || req.query.resetCheck === "1";
  const now = new Date().toISOString();

  let affectedRepoIds = [];
  const info = db.transaction(() => {
    if (resetCheck)
      affectedRepoIds = repoIdsForTagStmt.all(tag).map((r) => r.repo_id);
    const result = deleteTagEverywhereStmt.run(tag);
    unregisterTagStmt.run(tag);
    for (const repoId of affectedRepoIds) {
      const repo = findRepo(repoId);
      clearScheduleStmt.run({
        id: repoId,
        full_name: repo?.full_name ?? null,
        now,
      });
      logActivity(repoId, repo?.full_name ?? "", "clear", {
        reason: "tag_delete",
        tag,
      });
    }
    return result;
  })();
  invalidatePayloadCache();
  res.json({
    ok: true,
    removed: info.changes,
    resetCount: affectedRepoIds.length,
  });
});

// ---- Flags -----------------------------------------------------------------
router.get("/repos/:id/flags", (req, res) => {
  res.json({
    flags: flagsForRepoStmt.all(Number(req.params.id)).map((r) => r.flag),
  });
});

router.post("/repos/:id/flags", (req, res) => {
  const id = Number(req.params.id);
  const flag = normalizeTag(req.body?.flag);
  if (!flag)
    return res.status(400).json({ error: "flag must be a non-empty string" });
  const repo = findRepo(id);
  addFlagStmt.run({
    id,
    full_name: repo?.full_name ?? null,
    flag,
    now: new Date().toISOString(),
  });
  logActivity(id, repo?.full_name ?? "", "flag_add", { flag });
  invalidatePayloadCache();
  res.json({ ok: true, flag });
});

router.delete("/repos/:id/flags/:flag", (req, res) => {
  const id = Number(req.params.id);
  const flag = normalizeTag(req.params.flag);
  removeFlagStmt.run(id, flag);
  logActivity(id, findRepo(id)?.full_name ?? "", "flag_remove", { flag });
  invalidatePayloadCache();
  res.json({ ok: true });
});

// ---- Reports ---------------------------------------------------------------
router.get("/reports", (req, res) => {
  res.json({ kinds: REPORT_KINDS });
});

router.get("/reports/last-export", (req, res) => {
  res.json({ lastExport: getLastExport() });
});

router.get("/reports/:kind", (req, res) => {
  let report;
  try {
    report = buildReport(req.params.kind, buildPayload(), {
      days: req.query.days,
    });
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
  const format = req.query.format;
  if (format === "md" || format === "markdown")
    return res.type("text/markdown").send(toMarkdown(report));
  if (format === "csv") return res.type("text/csv").send(toCsv(report));
  res.json(report);
});

// ---- Backup / restore ------------------------------------------------------
const BACKUP_VERSION = 1;
router.get("/backup", (req, res) => {
  res.json({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    repo_state: db.prepare("SELECT * FROM repo_state").all(),
    repo_notice: db
      .prepare("SELECT repo_id, full_name, body, created_at FROM repo_notice")
      .all(),
    repo_tag: db
      .prepare("SELECT repo_id, full_name, tag, created_at FROM repo_tag")
      .all(),
    repo_flag: db
      .prepare("SELECT repo_id, full_name, flag, created_at FROM repo_flag")
      .all(),
    tag_registry: db.prepare("SELECT tag, created_at FROM tag_registry").all(),
  });
});

router.post("/restore", (req, res) => {
  const body = req.body || {};
  if (
    !Array.isArray(body.repo_state) ||
    !Array.isArray(body.repo_notice) ||
    !Array.isArray(body.repo_tag)
  ) {
    return res.status(400).json({
      error:
        "invalid backup: repo_state, repo_notice and repo_tag arrays are required",
    });
  }
  const now = new Date().toISOString();
  try {
    const restore = db.transaction(() => {
      db.prepare("DELETE FROM repo_state").run();
      db.prepare("DELETE FROM repo_notice").run();
      db.prepare("DELETE FROM repo_tag").run();
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
        restoreNoticeStmt.run({
          repo_id: n.repo_id,
          full_name: n.full_name ?? null,
          body: n.body,
          created_at: n.created_at ?? now,
        });
      }
      for (const t of body.repo_tag) {
        if (t.repo_id == null || !t.tag) continue;
        restoreTagStmt.run({
          repo_id: t.repo_id,
          full_name: t.full_name ?? null,
          tag: normalizeTag(t.tag),
          created_at: t.created_at ?? now,
        });
      }
      db.prepare("DELETE FROM repo_flag").run();
      for (const f of body.repo_flag || []) {
        if (f.repo_id == null || !f.flag) continue;
        restoreFlagStmt.run({
          repo_id: f.repo_id,
          full_name: f.full_name ?? null,
          flag: normalizeTag(f.flag),
          created_at: f.created_at ?? now,
        });
      }
      db.prepare("DELETE FROM tag_registry").run();
      for (const t of body.tag_registry || []) {
        if (!t.tag) continue;
        restoreTagRegistryStmt.run({
          tag: normalizeTag(t.tag),
          created_at: t.created_at ?? now,
        });
      }
      // Back-fill from the restored repo_tag rows, so tags still resolve for
      // backups predating the tag registry (or a registry-only tag that was pruned).
      db.prepare(
        `INSERT OR IGNORE INTO tag_registry (tag, created_at) SELECT DISTINCT tag, ? FROM repo_tag`,
      ).run(now);
    });
    restore();
  } catch (e) {
    return res
      .status(400)
      .json({ error: `restore failed: ${String(e.message || e)}` });
  }
  invalidatePayloadCache();
  res.json({
    ok: true,
    restored: {
      repo_state: body.repo_state.length,
      repo_notice: body.repo_notice.length,
      repo_tag: body.repo_tag.length,
      repo_flag: (body.repo_flag || []).length,
      tag_registry: (body.tag_registry || []).length,
    },
  });
});

export default router;
