import db from '../db.js';
import { fetchAllRepos, enrichRepos, resolveToken } from '../github.js';
import { ENRICH_METADATA, SYNC_AUTO, getEffectiveOwners } from './settings.js';
import { invalidatePayloadCache } from './payloadCache.js';

export let repoCache = [];
export let enrichCache = new Map();
export let lastFetch = null;
export let lastError = null;
export let cacheReady = false;
export let syncing = false;

export function findRepo(id) {
  return repoCache.find((r) => r.id === id);
}

export async function refreshRepos() {
  syncing = true;
  let fetched;
  try {
    fetched = await fetchAllRepos(getEffectiveOwners());
    repoCache = fetched;
    lastFetch = new Date().toISOString();
    lastError = null;
    cacheReady = true;
    invalidatePayloadCache();

    const insert = db.prepare(
      `INSERT OR IGNORE INTO repo_state (repo_id, full_name, updated_at) VALUES (?, ?, ?)`
    );
    const now = new Date().toISOString();
    const tx = db.transaction((repos) => {
      for (const r of repos) insert.run(r.id, r.full_name, now);
    });
    tx(repoCache);
  } finally {
    syncing = false;
  }

  // Board is usable now. Run enrichment in the background so GraphQL batches
  // don't delay the first GET /api/repos response after a sync.
  if (ENRICH_METADATA) {
    const snap = repoCache;
    const { token } = resolveToken();
    enrichRepos(snap, token).then((map) => {
      enrichCache = map;
      invalidatePayloadCache();
    }).catch(() => {});
  }

  return repoCache;
}

export function queueRefresh() {
  if (syncing) return false;
  refreshRepos().catch((e) => {
    lastError = String(e.message || e);
    console.warn(`  [sync] GitHub fetch failed: ${lastError}`);
  });
  return true;
}

let syncIntervalHandle = null;

export function restartSyncInterval(minutes) {
  /* v8 ignore next */
  if (syncIntervalHandle) clearInterval(syncIntervalHandle);
  /* v8 ignore next */
  if (!SYNC_AUTO || minutes < 1) return;
  /* v8 ignore next */
  syncIntervalHandle = setInterval(() => {
    /* v8 ignore next */
    if (queueRefresh()) console.log('  [auto-sync] Background GitHub sync started.');
  }, minutes * 60 * 1000);
}
