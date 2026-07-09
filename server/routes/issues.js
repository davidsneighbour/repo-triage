import { Router } from 'express';
import { findRepo } from '../lib/sync.js';
import {
  getAllStoredIssues,
  getStoredIssues,
  isIssueSyncEnabled,
  issueSyncStatus,
  setIssueFlagged,
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

// Cross-repo issue overview: every locally stored issue across all tracked
// repos, most recently active first. Read-only — never triggers a sync.
router.get('/issues', (req, res) => {
  const issues = getAllStoredIssues().map((issue) => {
    const repo = findRepo(issue.repo_id);
    return { ...issue, repo_full_name: repo?.full_name ?? null };
  });
  res.json({ issues });
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

// Local-only priority marker (never written upstream). Independent of sync —
// re-syncing an issue's title/body/labels never clears its flag.
router.post('/repos/:id/issues/:number/flag', (req, res) => {
  const repo = findRepo(Number(req.params.id));
  if (!repo) return res.status(404).json({ error: 'repo not found' });
  const number = Number(req.params.number);
  if (!Number.isInteger(number) || number <= 0) return res.status(400).json({ error: 'invalid issue number' });
  const flagged = Boolean(req.body?.flagged);
  const updated = setIssueFlagged(repo.id, number, flagged);
  if (!updated) return res.status(404).json({ error: 'issue not found — sync it first' });
  res.json({ ok: true, flagged });
});

// Manual "force refresh all" — same primitive the periodic timer uses.
router.post('/issues/sync', async (req, res) => {
  const results = await syncAllRepoIssues();
  res.json({ results, warnings: issueSyncStatus.warnings, lastRun: issueSyncStatus.lastRun });
});

export default router;
