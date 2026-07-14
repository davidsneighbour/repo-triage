import { Router } from "express";
import { cacheReady, lastFetch, queueRefresh, syncing } from "../lib/sync.js";

const router = Router();

// Queue a background sync and return immediately — the frontend polls
// /api/repos and picks up the result once `syncing` flips back to false.
router.post("/refresh", (req, res) => {
  const started = queueRefresh();
  res.json({ ok: true, queued: started, syncing, cacheReady, lastFetch });
});

export default router;
