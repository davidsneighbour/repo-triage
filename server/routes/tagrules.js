import { Router } from "express";
import db from "../db.js";
import { invalidatePayloadCache } from "../lib/payloadCache.js";

const router = Router();

const normalizeTag = (raw) =>
  typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 50) : "";

const listStmt = db.prepare("SELECT tag, days FROM tag_rule ORDER BY tag");
const upsertStmt = db.prepare(`
  INSERT INTO tag_rule (tag, days, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(tag) DO UPDATE SET days = excluded.days, updated_at = excluded.updated_at
`);
const deleteStmt = db.prepare("DELETE FROM tag_rule WHERE tag = ?");

router.get("/tag-rules", (req, res) => {
  res.json({ rules: listStmt.all() });
});

router.put("/tag-rules/:tag", (req, res) => {
  const tag = normalizeTag(req.params.tag);
  if (!tag)
    return res.status(400).json({ error: "tag must be a non-empty string" });
  const days = Number(req.body?.days);
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return res
      .status(400)
      .json({ error: "days must be an integer between 1 and 365" });
  }
  upsertStmt.run(tag, Math.round(days), new Date().toISOString());
  invalidatePayloadCache();
  res.json({ ok: true, tag, days: Math.round(days) });
});

router.delete("/tag-rules/:tag", (req, res) => {
  const tag = normalizeTag(req.params.tag);
  const info = deleteStmt.run(tag);
  if (info.changes) invalidatePayloadCache();
  res.json({ ok: true, removed: info.changes });
});

export default router;
