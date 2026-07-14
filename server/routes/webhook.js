import { createHmac, timingSafeEqual } from "node:crypto";
import express, { Router } from "express";
import { queueRefresh } from "../lib/sync.js";

const router = Router();

// Events that warrant a repo-list refresh.
const SYNC_EVENTS = new Set([
  "push",
  "create",
  "delete",
  "repository",
  "pull_request",
]);

export function verifySignature(secret, rawBody, sigHeader) {
  if (!secret) return true; // WEBHOOK_SECRET not configured → skip verification
  if (!sigHeader) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

router.post("/webhook", express.raw({ type: "*/*" }), (req, res) => {
  const secret = process.env.WEBHOOK_SECRET || "";
  const sig = req.headers["x-hub-signature-256"] || "";
  const event = req.headers["x-github-event"] || "";

  if (!verifySignature(secret, req.body, sig)) {
    return res.status(401).json({ error: "invalid signature" });
  }

  if (SYNC_EVENTS.has(event)) {
    queueRefresh();
  }

  res.json({ ok: true, event });
});

export default router;
