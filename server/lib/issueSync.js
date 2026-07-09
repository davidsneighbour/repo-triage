/**
 * @module lib/issueSync
 * @description Local sync engine for per-repository GitHub issues. Fetches
 * issues via `fetchRepoIssues()` in `github.js` and persists them to the
 * `repo_issue` table, independent of the repository-list sync in `sync.js`.
 * Three trigger modes share the same `syncRepoIssues()`/`syncAllRepoIssues()`
 * primitives: a periodic interval (`restartIssueSyncInterval`), an on-demand
 * single-repo refresh (`POST /api/repos/:id/issues/sync`), and a manual
 * refresh-all (`POST /api/issues/sync`).
 */
import db from '../db.js';
import { buildResolveOwnerToken, fetchRepoIssues, rateLimit } from '../github.js';
import { repoCache } from './sync.js';

/**
 * Per-run diagnostics for issue syncing, surfaced via `POST /api/issues/sync`.
 * Mirrors the `sourceStatus` pattern in `github.js`.
 *
 * @type {{ lastRun: string|null, warnings: string[] }}
 */
export const issueSyncStatus = {
  lastRun: null,
  warnings: [],
};

// Stop a bulk sync early once remaining GitHub API budget drops below this,
// so issue syncing never exhausts the quota the rest of the app needs.
const RATE_LIMIT_FLOOR = 100;

const upsertIssueStmt = db.prepare(`
  INSERT INTO repo_issue (repo_id, number, title, state, labels, body, html_url, github_updated_at, synced_at)
  VALUES (@repo_id, @number, @title, @state, @labels, @body, @html_url, @github_updated_at, @synced_at)
  ON CONFLICT(repo_id, number) DO UPDATE SET
    title             = excluded.title,
    state             = excluded.state,
    labels            = excluded.labels,
    body              = excluded.body,
    html_url          = excluded.html_url,
    github_updated_at = excluded.github_updated_at,
    synced_at         = excluded.synced_at
`);

const getIssueSyncEnabledStmt = db.prepare('SELECT issue_sync_enabled FROM repo_state WHERE repo_id = ?');
const setIssueSyncEnabledStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, issue_sync_enabled, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(repo_id) DO UPDATE SET issue_sync_enabled = excluded.issue_sync_enabled, updated_at = excluded.updated_at
`);
const getStoredIssuesStmt = db.prepare('SELECT * FROM repo_issue WHERE repo_id = ? ORDER BY number DESC');
const getAllStoredIssuesStmt = db.prepare('SELECT * FROM repo_issue ORDER BY github_updated_at DESC');
const setIssueFlaggedStmt = db.prepare('UPDATE repo_issue SET flagged = ? WHERE repo_id = ? AND number = ?');

/**
 * Whether issue sync is enabled for `repoId`. Opt-out: enabled unless a
 * `repo_state` row exists with `issue_sync_enabled = 0`.
 *
 * @param {number} repoId
 * @returns {boolean}
 */
export function isIssueSyncEnabled(repoId) {
  const row = getIssueSyncEnabledStmt.get(repoId);
  return row?.issue_sync_enabled == null ? true : Boolean(row.issue_sync_enabled);
}

/**
 * Enables or disables issue sync for one repository.
 *
 * @param {number} repoId
 * @param {boolean} enabled
 */
export function setIssueSyncEnabled(repoId, enabled) {
  setIssueSyncEnabledStmt.run(repoId, enabled ? 1 : 0, new Date().toISOString());
}

/**
 * Returns the locally stored issues for one repository, most recent number first.
 *
 * @param {number} repoId
 * @returns {object[]}
 */
export function getStoredIssues(repoId) {
  return getStoredIssuesStmt.all(repoId).map((row) => ({
    ...row,
    labels: JSON.parse(row.labels || '[]'),
    flagged: Boolean(row.flagged),
  }));
}

/**
 * Returns every locally stored issue across all repos, most recently active
 * first. Reads only from `repo_issue` — never triggers a GitHub sync.
 *
 * @returns {object[]}
 */
export function getAllStoredIssues() {
  return getAllStoredIssuesStmt.all().map((row) => ({
    ...row,
    labels: JSON.parse(row.labels || '[]'),
    flagged: Boolean(row.flagged),
  }));
}

/**
 * Sets or clears the local "flagged" marker for one synced issue. This is
 * independent of GitHub's own state — it is never written upstream, and
 * {@link syncRepoIssues}'s upsert never touches this column, so re-syncing
 * an issue does not clear its flag.
 *
 * @param {number} repoId
 * @param {number} number - Issue number (not the repo_issue row id).
 * @param {boolean} flagged
 * @returns {boolean} True if a matching stored issue was updated, false if none exists.
 */
export function setIssueFlagged(repoId, number, flagged) {
  const result = setIssueFlaggedStmt.run(flagged ? 1 : 0, repoId, number);
  return result.changes > 0;
}

/**
 * Fetches and persists issues for one repository. Used by the on-demand
 * ("repo detail opened") and manual single-repo sync routes, and internally
 * by {@link syncAllRepoIssues}.
 *
 * @param {{ id: number, full_name: string }} repo
 * @param {(owner: string|null) => { token: string|null, source: string|null }} [resolveOwnerToken]
 * @returns {Promise<{ ok: boolean, count: number }>}
 */
export async function syncRepoIssues(repo, resolveOwnerToken = buildResolveOwnerToken()) {
  const owner = repo.full_name.split('/')[0];
  const { token } = resolveOwnerToken(owner);
  if (!token) {
    issueSyncStatus.warnings.push(`No token available for "${repo.full_name}" — issue sync skipped.`);
    return { ok: false, count: 0 };
  }

  const issues = await fetchRepoIssues(repo.full_name, token);
  const now = new Date().toISOString();
  const tx = db.transaction((items) => {
    for (const it of items) {
      upsertIssueStmt.run({
        repo_id: repo.id,
        number: it.number,
        title: it.title,
        state: it.state,
        labels: JSON.stringify(it.labels),
        body: it.body,
        html_url: it.html_url,
        github_updated_at: it.github_updated_at,
        synced_at: now,
      });
    }
  });
  tx(issues);

  return { ok: true, count: issues.length };
}

/**
 * Syncs issues for every tracked repo that has issue sync enabled (opt-out).
 * Stops early — recording a warning — if the shared GitHub rate-limit budget
 * drops below {@link RATE_LIMIT_FLOOR}. Per-repo failures (missing repo, auth,
 * transient errors) are recorded as warnings and do not stop the run.
 *
 * @returns {Promise<Array<{ repo: string, ok: boolean, count: number }>>}
 */
export async function syncAllRepoIssues() {
  issueSyncStatus.warnings = [];
  const resolveOwnerToken = buildResolveOwnerToken();
  const results = [];

  for (const repo of repoCache) {
    if (!isIssueSyncEnabled(repo.id)) continue;
    if (rateLimit.remaining !== null && rateLimit.remaining < RATE_LIMIT_FLOOR) {
      issueSyncStatus.warnings.push(
        `Stopped issue sync early — GitHub API rate limit budget low (remaining ${rateLimit.remaining}).`
      );
      break;
    }
    try {
      const result = await syncRepoIssues(repo, resolveOwnerToken);
      results.push({ repo: repo.full_name, ...result });
    } catch (e) {
      issueSyncStatus.warnings.push(`Could not sync issues for "${repo.full_name}": ${e.message}`);
      results.push({ repo: repo.full_name, ok: false, count: 0 });
    }
  }

  issueSyncStatus.lastRun = new Date().toISOString();
  return results;
}

let issueSyncIntervalHandle = null;

/**
 * (Re)starts the periodic issue-sync timer. Passing a falsy/`< 1` interval
 * clears the timer without starting a new one (used when auto-sync is off).
 *
 * @param {number} minutes
 */
export function restartIssueSyncInterval(minutes) {
  /* v8 ignore next */
  if (issueSyncIntervalHandle) clearInterval(issueSyncIntervalHandle);
  /* v8 ignore next */
  if (!minutes || minutes < 1) return;
  /* v8 ignore next */
  issueSyncIntervalHandle = setInterval(() => {
    /* v8 ignore next */
    syncAllRepoIssues().catch((e) => console.warn(`  [issue-sync] failed: ${e.message}`));
  }, minutes * 60 * 1000);
}
