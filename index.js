import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { fetchAllRepos } from './github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DEFAULT_INACTIVITY_DAYS = Number(process.env.DEFAULT_INACTIVITY_DAYS || 7);

const app = express();
app.use(express.json());

// ---- GitHub repo cache -----------------------------------------------------
let repoCache = [];
let lastFetch = null;
let lastError = null;

async function refreshRepos() {
  repoCache = await fetchAllRepos();
  lastFetch = new Date().toISOString();
  lastError = null;

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
}

// ---- Degradation rule ------------------------------------------------------
// A repo assigned P1..P3 stays there until `inactivity_days` pass with no
// triage activity, then it auto-degrades into the "Look again" column (4).
function effectiveState(state) {
  const days = state.inactivity_days ?? DEFAULT_INACTIVITY_DAYS;

  if (state.priority == null) {
    return { column: 'unsorted', effectivePriority: null, degraded: false, daysLeft: null };
  }
  if (state.priority_set_at) {
    const ageDays = (Date.now() - new Date(state.priority_set_at).getTime()) / 86400000;
    if (ageDays >= days) {
      return { column: 'look-again', effectivePriority: 4, degraded: true, daysLeft: 0 };
    }
    return {
      column: `p${state.priority}`,
      effectivePriority: state.priority,
      degraded: false,
      daysLeft: Math.max(0, Math.ceil(days - ageDays)),
    };
  }
  return { column: `p${state.priority}`, effectivePriority: state.priority, degraded: false, daysLeft: days };
}

function buildPayload() {
  const states = db.prepare('SELECT * FROM repo_state').all();
  const byId = new Map(states.map((s) => [s.repo_id, s]));
  return repoCache.map((r) => {
    const s = byId.get(r.id) || { priority: null, priority_set_at: null, inactivity_days: null, position: 0 };
    return {
      ...r,
      priority: s.priority,
      priority_set_at: s.priority_set_at,
      inactivity_days: s.inactivity_days,
      effective_inactivity_days: s.inactivity_days ?? DEFAULT_INACTIVITY_DAYS,
      position: s.position ?? 0,
      ...effectiveState(s),
    };
  });
}

// ---- Prepared statements ---------------------------------------------------
const setPriorityStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, priority, priority_set_at, updated_at)
  VALUES (@id, @full_name, @priority, @set_at, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    priority = excluded.priority,
    priority_set_at = excluded.priority_set_at,
    updated_at = excluded.updated_at
`);
const touchStmt = db.prepare(`UPDATE repo_state SET priority_set_at = ?, updated_at = ? WHERE repo_id = ?`);
const inactivityStmt = db.prepare(`
  INSERT INTO repo_state (repo_id, full_name, inactivity_days, updated_at)
  VALUES (@id, @full_name, @days, @now)
  ON CONFLICT(repo_id) DO UPDATE SET
    inactivity_days = excluded.inactivity_days,
    updated_at = excluded.updated_at
`);
const positionStmt = db.prepare(`UPDATE repo_state SET position = ?, updated_at = ? WHERE repo_id = ?`);

const findRepo = (id) => repoCache.find((r) => r.id === id);

// ---- API -------------------------------------------------------------------
app.get('/api/repos', (req, res) => {
  res.json({
    repos: buildPayload(),
    lastFetch,
    lastError,
    defaultInactivityDays: DEFAULT_INACTIVITY_DAYS,
    username: process.env.GITHUB_USERNAME || null,
    tokenPresent: Boolean(process.env.GITHUB_TOKEN),
  });
});

app.post('/api/refresh', async (req, res) => {
  try {
    await refreshRepos();
    res.json({ ok: true, count: repoCache.length, repos: buildPayload(), lastFetch });
  } catch (e) {
    lastError = String(e.message || e);
    res.status(500).json({ ok: false, error: lastError });
  }
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
    now,
  });
  res.json({ ok: true });
});

// "I looked" — keeps the assigned priority but resets the inactivity timer.
app.post('/api/repos/:id/touch', (req, res) => {
  const now = new Date().toISOString();
  touchStmt.run(now, now, Number(req.params.id));
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

// ---- Static client (built by Vite) ----------------------------------------
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

app.listen(PORT, async () => {
  console.log(`\n  Repo Triage Dashboard → http://localhost:${PORT}\n`);
  try {
    await refreshRepos();
    console.log(`  Loaded ${repoCache.length} repositories from GitHub.`);
  } catch (e) {
    lastError = String(e.message || e);
    console.warn(`  Initial GitHub fetch failed: ${lastError}`);
  }
});
