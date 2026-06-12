import db from '../db.js';
import { repoCache, enrichCache } from './sync.js';
import { getEffectiveInactivityDays, DAY_ROLLOVER_HOUR } from './settings.js';
import { effectiveState } from '../schedule.js';
import { getPayloadCache, setPayloadCache } from './payloadCache.js';

export function buildPayload() {
  const cached = getPayloadCache();
  if (cached) return cached;

  const states = db.prepare('SELECT * FROM repo_state').all();
  const byId = new Map(states.map((s) => [s.repo_id, s]));

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

  const flagRows = db.prepare('SELECT repo_id, flag FROM repo_flag ORDER BY flag').all();
  const flagsByRepo = new Map();
  for (const f of flagRows) {
    const list = flagsByRepo.get(f.repo_id);
    if (list) list.push(f.flag);
    else flagsByRepo.set(f.repo_id, [f.flag]);
  }

  const result = repoCache.map((r) => {
    const s = byId.get(r.id) || { priority: null, priority_set_at: null, inactivity_days: null, position: 0, ignored: 0, snooze_until: null };
    const enrich = enrichCache.get(r.id) ?? {};
    const defaultInactivityDays = getEffectiveInactivityDays();
    return {
      ...r,
      ...enrich,
      priority: s.priority,
      priority_set_at: s.priority_set_at,
      checked_at: s.checked_at ?? null,
      inactivity_days: s.inactivity_days,
      effective_inactivity_days: s.inactivity_days ?? defaultInactivityDays,
      position: s.position ?? 0,
      ignored: Boolean(s.ignored),
      snooze_until: s.snooze_until ?? null,
      notice_count: countByRepo.get(r.id) ?? 0,
      latest_notice: latestByRepo.get(r.id) ?? null,
      tags: tagsByRepo.get(r.id) ?? [],
      flags: flagsByRepo.get(r.id) ?? [],
      ...effectiveState(s, defaultInactivityDays, Date.now(), DAY_ROLLOVER_HOUR),
    };
  });
  setPayloadCache(result);
  return result;
}
