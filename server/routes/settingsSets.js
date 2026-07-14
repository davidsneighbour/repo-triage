import { Router } from "express";
import {
  evaluatePreset,
  findPreset,
  getSettingsSets,
} from "../lib/settingsSets.js";
import { findRepo } from "../lib/sync.js";

const router = Router();

router.get("/settings-sets", (req, res) => {
  res.json({ presets: getSettingsSets() });
});

router.get("/repos/:id/settings-sets/:presetId", (req, res) => {
  const repo = findRepo(Number(req.params.id));
  if (!repo) return res.status(404).json({ error: "repo not found" });
  const preset = findPreset(req.params.presetId);
  if (!preset) return res.status(404).json({ error: "preset not found" });
  res.json(evaluatePreset(repo, preset));
});

export default router;
