import { Router } from 'express';
import { findRepo } from '../lib/sync.js';
import {
  getStoredIssues,
  isIssueSyncEnabled,
  issueSyncStatus,
  setIssueSyncEnabled,
  syncAllRepoIssues,
  syncRepoIssues,
} from '../lib/issueSync.js';

const router = Router();

// Locally stored issues for one repo (populated by periodic/on-demand/manual sync).
router.get('/repos/:id/issues', (req, res) => {
  const repo = findRepo(Number(req.params.id));
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  res.json({ issues: getStoredIssues(repo.id), syncEnabled: isIssueSyncEnabled(repo.id) });
});

// On-demand / manual single-repo refresh (e.g. triggered when a repo detail view opens).
router.post('/repos/:id/issues/sync', async (req, res) => {
  const repo = findRepo(Number(req.params.id));
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  try {
    const result = await syncRepoIssues(repo);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Opt-out toggle: issue sync is enabled by default per repo.
router.put('/repos/:id/issue-sync', (req, res) => {
  const repo = findRepo(Number(req.params.id));
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  const enabled = Boolean(req.body?.enabled);
  setIssueSyncEnabled(repo.id, enabled);
  res.json({ ok: true, syncEnabled: enabled });
});

// Manual "force refresh all" — same primitive the periodic timer uses.
router.post('/issues/sync', async (req, res) => {
  const results = await syncAllRepoIssues();
  res.json({ results, warnings: issueSyncStatus.warnings, lastRun: issueSyncStatus.lastRun });
});

export default router;
