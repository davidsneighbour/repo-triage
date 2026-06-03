import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import db from './db.js';
import { fetchAllRepos, rateLimit, sourceStatus, authStatus, parseOwners } from './github.js';
import { effectiveState } from './schedule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DEFAULT_INACTIVITY_DAYS = Number(process.env.DEFAULT_INACTIVITY_DAYS || 7);
const SYNC_ON_STARTUP = process.env.SYNC_ON_STARTUP !== 'false';
const SYNC_AUTO = process.env.SYNC_AUTO !== 'false';
const SYNC_INTERVAL_MINUTES = Math.max(1, Number(process.env.SYNC_INTERVAL_MINUTES || 60));

const app = express();
app.use(express.json());

// ---- GitHub repo cache -----------------------------------------------------
let repoCache = [];
let lastFetch = null;
let lastError = null;
let cacheReady = false; // false until the first successful GitHub fetch completes
let syncing = false; // true while a GitHub fetch is in flight

async function refreshRepos() {
  syncing = true;
  try {
    const fetched = await fetchAllRepos();
    // Only swap the cache in once the fetch has fully succeeded, so an in-flight
    // sync never momentarily empties the board.
    repoCache = fetched;
    lastFetch = new Date().toISOString();
    lastError = null;
    cacheReady = true;

    // Make sure every repo has a state row so settings can be attached later.
    const insert = db.prepare(
      `INSERT OR IGNORE INTO repo_state (repo_id, full_name, updated_at) VALUES (?, ?, ?)`
    );
    const now = new Date().toISOString();
    const tx = db.transaction((repos) => {
      for (const r of repos) insert.run(r.id, r.full_name, now);
    });
    tx(repoCache);
    return repoCache;
  } finally {
    syncing = false;
  }
}

// Fire-and-forget background sync. Returns true if a new sync was started, false
// if one was already running. refreshRepos() flips `syncing` true synchronously
// before its first await, so a concurrent call here can't double-queue.
function queueRefresh() {
  if (syncing) return false;
  refreshRepos().catch((e) => {
    lastError = String(e.message || e);
    console.warn(`  [sync] GitHub fetch failed: ${lastError}`);
  });
  return true;
}

function buildPayload() {
  const states = db.prepare('SELECT * FROM repo_state').all();
  const byId = new Map(states.map((s) => [s.repo_id, s]));

  // Newest notice per repo (highest id) for the card, plus a per-repo count.
  const latestNotices = db
    .prepare(
      `SELECT n.repo_id, n.body, n.created_at
         FROM repo_notice n
         JOIN (SELECT repo_id, MAX(id) AS max_id FROM repo_notice GROUP BY repo_id) m
           ON n.id = m.max_id`
    )
    .all();
  const latestByRepo = new Map(latestNotices.map((n) => [n.repo_id, { body: n.body, created_at: n.created_at }]));
  const noticeCounts = db.prepare('SELECT repo_id, COUNT(*) AS n FROM repo_notice GROUP BY repo_id').all();
  const countByRepo = new Map(noticeCounts.map((c) => [c.repo_id, c.n]));

  const tagRows = db.prepare('SELECT repo_id, tag FROM repo_tag ORDER BY tag').all();
  const tagsByRepo = new Map();
  for (const t of tagRows) {
    const list = tagsByRepo.get(t.repo_id);
    if (list) list.push(t.tag);
    else tagsByRepo.set(t.repo_id, [t.tag]);
  }

  return repoCache.map((r) => {
    const s = byId.get(r.id) || { priority: null, priority_set_at: null, inactivity_days: null, position: 0, ignored: 0 };
    return {
      ...r,
      priority: s.priority,
      priority_set_at: s.priority_set_at,
      inactivity_days: s.inactivity_days,
      effective_inactivity_days: s.inactivity_days ?? DEFAULT_INACTIVITY_DAYS,
      position: s.position ?? 0,
      ignored: Boolean(s.ignored),
      notice_count: countByRepo.get(r.id) ?? 0,
      latest_notice: latestByRepo.get(r.id) ?? null,
      tags: tagsByRepo.get(r.id) ?? [],
      ...effectiveState(s, DEFAULT_INACTIVITY_DAYS),
    };
  });
}

// ---- Prepared statements ---------------------------------------------------
const setPriorityStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority, priority_set_at, checked_at, updated_at)
  VALUES (@id, @full_name, @priority, @set_at, @checked_at, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    priority = excluded.priority,
    priority_set_at = excluded.priority_set_at,
    checked_at = excluded.checked_at,
    updated_at = excluded.updated_at
`);
const setCheckedStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority, priority_set_at, checked_at, updated_at)
  VALUES (@id, @full_name, 1, @set_at, @checked_at, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    priority = 1,
    priority_set_at = excluded.priority_set_at,
    -- Only record a real review (checked_at = now) when this lands the card in a
    -- future column; a null means "make due" and must keep the prior checked_at.
    checked_at = COALESCE(excluded.checked_at, repo_state.checked_at),
    updated_at = excluded.updated_at
`);
const getInactivityStmt = db.prepare('SELECT inactivity_days FROM repo_state WHERE repo_id = ?');
const touchStmt = db.prepare(`UPDATE repo_state SET priority_set_at = ?, checked_at = ?, updated_at = ? WHERE repo_id = ?`);
const inactivityStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, inactivity_days, updated_at)
  VALUES (@id, @full_name, @days, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    inactivity_days = excluded.inactivity_days,
    updated_at = excluded.updated_at
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
  VALUES (@id, @full_name, @body, @now)
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
const tagsForRepoStmt = db.prepare('SELECT tag FROM repo_tag WHERE repo_id = ? ORDER BY tag');
const allTagsStmt = db.prepare('SELECT tag, COUNT(*) AS count FROM repo_tag GROUP BY tag ORDER BY count DESC, tag ASC');

// Tags are normalised to a trimmed, lower-case, length-capped token.
const normalizeTag = (raw) => (typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 50) : '');

const findRepo = (id) => repoCache.find((r) => r.id === id);

// ---- API -------------------------------------------------------------------
app.get('/api/repos', (req, res) => {
  if (!cacheReady) {
    console.log('[/api/repos] cache not ready yet — GitHub fetch still in progress');
  }
  res.json({
    repos: buildPayload(),
    cacheReady,
    syncing,
    lastFetch,
    lastError,
    defaultInactivityDays: DEFAULT_INACTIVITY_DAYS,
    username: process.env.GITHUB_USERNAME || null,
    owners: parseOwners(process.env.GITHUB_OWNERS ?? process.env.GITHUB_USERNAME),
    sourceWarnings: [...sourceStatus.warnings],
    tokenPresent: authStatus.present || Boolean(process.env.GITHUB_TOKEN),
    authSource: authStatus.source,
    rateLimit: { ...rateLimit },
  });
});

// Queue a background sync and return immediately — the frontend polls
// /api/repos and picks up the result once `syncing` flips back to false.
app.post('/api/refresh', (req, res) => {
  const started = queueRefresh();
  res.json({ ok: true, queued: started, syncing, cacheReady, lastFetch });
});

app.post('/api/repos/:id/priority', (req, res) => {
  const id = Number(req.params.id);
  const { priority } = req.body;
  if (priority !== null && ![1, 2, 3].includes(priority)) {
    return res.status(400).json({ error: 'priority must be 1, 2, 3 or null' });
  }
  const now = new Date().toISOString();
  setPriorityStmt.run({
    id,
    full_name: findRepo(id)?.full_name ?? null,
    priority,
    set_at: priority === null ? null : now,
    // Clearing the check date also clears the real review timestamp.
    checked_at: priority === null ? null : now,
    now,
  });
  res.json({ ok: true });
});

app.post('/api/repos/:id/check', (req, res) => {
  const id = Number(req.params.id);
  let { daysAgo } = req.body || {};
  daysAgo = Number(daysAgo ?? 0);
  if (!Number.isFinite(daysAgo) || daysAgo < 0) {
    return res.status(400).json({ error: 'daysAgo must be a non-negative number' });
  }

  const now = new Date();
  const anchorAt = new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const nowIso = now.toISOString();

  // The card lands in a future column iff daysAgo is below its review interval.
  // That means "I reviewed it now, resurface later" → stamp the real check time.
  // Otherwise it lands in Today ("make this due") → leave checked_at untouched.
  const effectiveInactivity = getInactivityStmt.get(id)?.inactivity_days ?? DEFAULT_INACTIVITY_DAYS;
  const isReview = daysAgo < effectiveInactivity;

  setCheckedStmt.run({
    id,
    full_name: findRepo(id)?.full_name ?? null,
    set_at: anchorAt,
    checked_at: isReview ? nowIso : null,
    now: nowIso,
  });
  res.json({ ok: true });
});

// "I looked" — keeps the assigned priority but resets the inactivity timer and
// records a real review.
app.post('/api/repos/:id/touch', (req, res) => {
  const now = new Date().toISOString();
  touchStmt.run(now, now, now, Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/repos/:id/inactivity', (req, res) => {
  const id = Number(req.params.id);
  let { days } = req.body;
  if (days !== null) {
    days = Number(days);
    if (!Number.isFinite(days) || days < 0) return res.status(400).json({ error: 'days must be a non-negative number or null' });
  }
  inactivityStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, days, now: new Date().toISOString() });
  res.json({ ok: true });
});

app.post('/api/reorder', (req, res) => {
  const { orderedIds } = req.body || {};
  const now = new Date().toISOString();
  const tx = db.transaction((ids) => ids.forEach((id, i) => positionStmt.run(i, now, Number(id))));
  tx(Array.isArray(orderedIds) ? orderedIds : []);
  res.json({ ok: true });
});

// Ignore flag — ignored repos drop off the board unless "show ignored" is on.
app.post('/api/repos/:id/ignore', (req, res) => {
  const id = Number(req.params.id);
  const { ignored } = req.body || {};
  if (typeof ignored !== 'boolean') return res.status(400).json({ error: 'ignored must be a boolean' });
  setIgnoredStmt.run({
    id,
    full_name: findRepo(id)?.full_name ?? null,
    ignored: ignored ? 1 : 0,
    now: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// ---- Notices ---------------------------------------------------------------
app.post('/api/repos/:id/notices', (req, res) => {
  const id = Number(req.params.id);
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'body must be a non-empty string' });
  const info = addNoticeStmt.run({
    id,
    full_name: findRepo(id)?.full_name ?? null,
    body,
    now: new Date().toISOString(),
  });
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.get('/api/repos/:id/notices', (req, res) => {
  res.json({ notices: noticesForRepoStmt.all(Number(req.params.id)) });
});

// All notices across every repo, sortable by date or repo name.
app.get('/api/notices', (req, res) => {
  const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
  const orderBy =
    req.query.sort === 'repo' ? `full_name ${dir}, created_at ${dir}` : `created_at ${dir}, id ${dir}`;
  const notices = db
    .prepare(`SELECT id, repo_id, full_name, body, created_at FROM repo_notice ORDER BY ${orderBy}`)
    .all();
  res.json({ notices });
});

app.delete('/api/notices/:noticeId', (req, res) => {
  deleteNoticeStmt.run(Number(req.params.noticeId));
  res.json({ ok: true });
});

// ---- Tags ------------------------------------------------------------------
app.get('/api/repos/:id/tags', (req, res) => {
  res.json({ tags: tagsForRepoStmt.all(Number(req.params.id)).map((r) => r.tag) });
});

app.post('/api/repos/:id/tags', (req, res) => {
  const id = Number(req.params.id);
  const tag = normalizeTag(req.body?.tag);
  if (!tag) return res.status(400).json({ error: 'tag must be a non-empty string' });
  addTagStmt.run({ id, full_name: findRepo(id)?.full_name ?? null, tag, now: new Date().toISOString() });
  res.json({ ok: true, tag });
});

app.delete('/api/repos/:id/tags/:tag', (req, res) => {
  removeTagStmt.run(Number(req.params.id), normalizeTag(req.params.tag));
  res.json({ ok: true });
});

// Distinct tags across all repos with usage counts (for the CLI and reports).
app.get('/api/tags', (req, res) => {
  res.json({ tags: allTagsStmt.all() });
});

// ---- Static client (built by Vite) ----------------------------------------
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

function startServer() {
  app.listen(PORT, () => {
    console.log(`\n  Repo Triage Dashboard → http://localhost:${PORT}\n`);
    console.log(`  Sync on startup: ${SYNC_ON_STARTUP} | Auto-sync: ${SYNC_AUTO} every ${SYNC_INTERVAL_MINUTES}m`);

    // Kick off the initial GitHub load in the background so a slow fetch never
    // blocks the server from accepting requests. The frontend polls /api/repos
    // and shows its cached board (or a "fetching" state) until cacheReady flips.
    if (SYNC_ON_STARTUP) {
      queueRefresh();
      console.log('  Background GitHub sync started.');
    }

    if (SYNC_AUTO) {
      setInterval(() => {
        if (queueRefresh()) console.log('  [auto-sync] Background GitHub sync started.');
      }, SYNC_INTERVAL_MINUTES * 60 * 1000);
    }
  });
}

// Only boot the HTTP server + sync loop when run directly (node index.js).
// When imported by tests, the app is exported untouched so routes can be
// exercised with supertest against an in-process instance.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) startServer();

export { app, refreshRepos, buildPayload };
