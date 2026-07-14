import { Router } from "express";
import db from "../db.js";
import { invalidatePayloadCache } from "../lib/payloadCache.js";

const router = Router();

const listStmt = db.prepare(
  `SELECT id, label, ops, created_at FROM undo_log ORDER BY id DESC LIMIT 20`,
);
const insertStmt = db.prepare(
  `INSERT INTO undo_log (label, ops, created_at) VALUES (?, ?, ?)`,
);
const getStmt = db.prepare(`SELECT id, label, ops FROM undo_log WHERE id = ?`);
const deleteStmt = db.prepare(`DELETE FROM undo_log WHERE id = ?`);
const trimStmt = db.prepare(
  `DELETE FROM undo_log WHERE id NOT IN (SELECT id FROM undo_log ORDER BY id DESC LIMIT 20)`,
);

// Supported op types that can be replayed server-side.
const restoreScheduleStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority_set_at, checked_at, updated_at)
  VALUES (@repo_id, @full_name, @priority_set_at, @checked_at, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    priority_set_at = excluded.priority_set_at,
    checked_at = COALESCE(excluded.checked_at, repo_state.checked_at),
    updated_at = excluded.updated_at
`);
const setIgnoredStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, ignored, updated_at)
  VALUES (@repo_id, @full_name, @ignored, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    ignored = excluded.ignored,
    updated_at = excluded.updated_at
`);

function executeOps(ops) {
  const now = new Date().toISOString();
  for (const op of ops) {
    if (op.type === "restoreState") {
      restoreScheduleStmt.run({
        repo_id: op.repoId,
        full_name: op.fullName ?? null,
        priority_set_at: op.prioritySetAt ?? null,
        checked_at: op.checkedAt ?? null,
        now,
      });
    } else if (op.type === "setIgnored") {
      setIgnoredStmt.run({
        repo_id: op.repoId,
        full_name: op.fullName ?? null,
        ignored: op.ignored ? 1 : 0,
        now,
      });
    }
  }
}

router.get("/undo", (req, res) => {
  const entries = listStmt.all().map((e) => ({ ...e, ops: JSON.parse(e.ops) }));
  res.json({ entries });
});

router.post("/undo", (req, res) => {
  const { label, ops } = req.body || {};
  if (typeof label !== "string" || !label.trim()) {
    return res.status(400).json({ error: "label must be a non-empty string" });
  }
  if (!Array.isArray(ops) || ops.length === 0) {
    return res.status(400).json({ error: "ops must be a non-empty array" });
  }
  const now = new Date().toISOString();
  const info = insertStmt.run(label.trim(), JSON.stringify(ops), now);
  trimStmt.run();
  res.json({
    ok: true,
    id: info.lastInsertRowid,
    label: label.trim(),
    ops,
    created_at: now,
  });
});

router.post("/undo/:id", (req, res) => {
  const entry = getStmt.get(Number(req.params.id));
  if (!entry) return res.status(404).json({ error: "undo entry not found" });
  let ops;
  try {
    ops = JSON.parse(entry.ops);
  } catch {
    return res.status(400).json({ error: "corrupt undo entry" });
  }
  try {
    db.transaction(() => executeOps(ops))();
  } catch (e) {
    return res
      .status(400)
      .json({ error: `undo failed: ${String(e.message || e)}` });
  }
  deleteStmt.run(entry.id);
  invalidatePayloadCache();
  res.json({ ok: true });
});

router.delete("/undo/:id", (req, res) => {
  const info = deleteStmt.run(Number(req.params.id));
  res.json({ ok: true, removed: info.changes });
});

export default router;
