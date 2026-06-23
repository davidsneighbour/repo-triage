/**
 * @module github
 * @description GitHub REST API client: multi-owner repository fetching,
 *   rate-limit tracking, per-repo GraphQL enrichment via `gh api graphql`,
 *   and token resolution from the encrypted tokens table, `GITHUB_TOKEN` env,
 *   or `gh auth token`.
 */
import { execFileSync, spawn } from 'node:child_process';
import { resolveTokenForOwner as dbResolveToken } from './lib/tokenManager.js';

const GITHUB_API = 'https://api.github.com';

// ---- Shared rate-limit state -----------------------------------------------
// Exported so server/index.js can include it in every API response.
/**
 * Shared rate-limit state updated after every GitHub API response.
 * Included verbatim in `GET /api/repos` so the UI can show remaining quota.
 *
 * @type {{ limit: number|null, remaining: number|null, used: number|null, reset: number|null, lastChecked: string|null, authInvalid: boolean }}
 */
export const rateLimit = {
  limit: null,       // total requests allowed per window
  remaining: null,   // requests remaining in current window
  used: null,        // requests consumed
  reset: null,       // Unix timestamp (seconds) when the window resets
  lastChecked: null, // ISO timestamp of the last GitHub response we parsed
  authInvalid: false,// true after a 401 — set back to false on success
};

// ---- Per-sync source diagnostics -------------------------------------------
// Reset at the start of every fetchAllRepos() and surfaced to the UI so the
// user can see which owners loaded and any non-fatal access warnings.
/**
 * Per-sync source diagnostics reset at the start of every `fetchAllRepos()`.
 *
 * @type {{ owners: Array<{owner: string|null, count: number, scope: string}>, warnings: string[] }}
 */
export const sourceStatus = {
  owners: [],   // [{ owner, count, scope }] — scope: self|member|public|error
  warnings: [], // human-readable, non-fatal messages (e.g. org access fell back to public)
};

/**
 * Which credential the last `resolveToken()` call used; surfaced in `/api/repos`.
 *
 * @type {{ source: 'env'|'gh'|null, present: boolean }}
 */
export const authStatus = {
  source: null,   // 'env' (GITHUB_TOKEN) | 'gh' (gh auth token) | null
  present: false, // whether a usable token was resolved
};

/**
 * Parses GitHub rate-limit response headers into `target` (defaults to the
 * shared {@link rateLimit} singleton). Safe to call on any response.
 *
 * @param {object} res - Fetch response (or any object with a `headers.get(key)` method).
 * @param {object} [target=rateLimit] - Object to write the parsed values into.
 */
export function parseRateLimitHeaders(res, target = rateLimit) {
  const h = (k) => res.headers.get(k);
  if (h('x-ratelimit-limit') !== null) target.limit = Number(h('x-ratelimit-limit'));
  if (h('x-ratelimit-remaining') !== null) target.remaining = Number(h('x-ratelimit-remaining'));
  if (h('x-ratelimit-used') !== null) target.used = Number(h('x-ratelimit-used'));
  if (h('x-ratelimit-reset') !== null) target.reset = Number(h('x-ratelimit-reset'));
  target.lastChecked = new Date().toISOString();
}

/**
 * Parses the configured owner list from `GITHUB_OWNERS` (or a raw string).
 * Accepts a comma/space-separated string (`"a, b c"`) or a JSON array
 * (`'["a","b"]'`). Returns a de-duplicated, case-preserving array in input order.
 *
 * @param {string|null|undefined} raw - Raw owner list string.
 * @returns {string[]} Parsed, de-duplicated owner logins.
 * @example
 * parseOwners('davidsneighbour, dnbhq');     // ['davidsneighbour', 'dnbhq']
 * parseOwners('["foo","foo","bar"]');         // ['foo', 'bar']
 */
export function parseOwners(raw) {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];

  let list = null;
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) list = parsed;
    } catch { /* not valid JSON — fall through to delimiter split */ }
  }
  if (!Array.isArray(list)) list = s.split(/[\s,]+/);

  const seen = new Set();
  const out = [];
  for (const item of list) {
    const v = String(item ?? '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Asks the GitHub CLI (`gh auth token`) for the authenticated user's token.
 * Returns `null` if `gh` is missing, not logged in, or exits non-zero — so
 * {@link resolveToken} can fall through to the "no token" path cleanly.
 *
 * @returns {string|null} The token string, or `null` on failure.
 */
export function ghAuthToken() {
  try {
    const out = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    const token = String(out).trim();
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the best available GitHub token. Prefers `GITHUB_TOKEN` env; falls
 * back to `gh auth token` so no PAT is needed when `gh auth login` is active.
 *
 * @returns {{ token: string|null, source: 'env'|'gh'|null }} Token and its source.
 */
export function resolveToken() {
  const env = (process.env.GITHUB_TOKEN || '').trim();
  if (env) return { token: env, source: 'env' };
  const gh = ghAuthToken();
  if (gh) return { token: gh, source: 'gh' };
  return { token: null, source: null };
}

/**
 * Returns a per-owner token resolver backed by the DB token table and the
 * env / gh-CLI fallback. Pass `null` as owner to get the best available
 * token with no owner preference (used for the viewer-login probe and for
 * the no-owners repo fetch).
 *
 * @returns {(owner: string|null) => { token: string|null, source: 'db'|'env'|'gh'|null }}
 */
export function buildResolveOwnerToken() {
  const fallback = resolveToken();
  return function (owner) {
    if (owner) {
      const dbToken = dbResolveToken(owner);
      if (dbToken) return { token: dbToken, source: 'db' };
    }
    return fallback;
  };
}

function buildHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'repo-dashboard',
  };
}

function assertRateBudget() {
  if (rateLimit.remaining === 0 && rateLimit.reset && Math.floor(Date.now() / 1000) < rateLimit.reset) {
    const secsLeft = Math.ceil(rateLimit.reset - Date.now() / 1000);
    const resetAt = new Date(rateLimit.reset * 1000).toLocaleTimeString();
    throw new Error(`GitHub API rate limit exhausted — resets at ${resetAt} (in ${secsLeft}s)`);
  }
}

// Single GET that records rate-limit headers and throws on the two fatal
// conditions (invalid token, exhausted rate limit). All other statuses are
// returned to the caller so it can decide whether to fall back.
async function ghGet(url, headers) {
  const res = await fetch(url, { headers });
  parseRateLimitHeaders(res);

  if (res.status === 401) {
    rateLimit.authInvalid = true;
    const body = await res.text().catch(() => '');
    let msg = 'GitHub token is invalid or expired (401).';
    try {
      const parsed = JSON.parse(body);
      if (parsed.message) msg += ` GitHub says: "${parsed.message}"`;
    } catch { /* body wasn't JSON */ }
    throw new Error(msg);
  }

  if (res.status === 403 && rateLimit.remaining === 0) {
    const resetAt = rateLimit.reset ? new Date(rateLimit.reset * 1000).toLocaleTimeString() : 'unknown';
    throw new Error(`GitHub API rate limit exhausted (403) — resets at ${resetAt}`);
  }

  return res;
}

function repoListError({ status, body }) {
  if (status === 403) return new Error(`GitHub API 403 Forbidden: ${(body || '').slice(0, 200)}`);
  return new Error(`GitHub API ${status}: ${(body || '').slice(0, 200)}`);
}

// Paginate a repos listing. makeUrl(page, perPage) -> url. Returns
// { ok, status, body, repos } — `repos` holds whatever was collected.
async function paginateRepos(makeUrl, headers) {
  const out = [];
  const perPage = 100;
  for (let page = 1; page <= 50; page++) {
    const res = await ghGet(makeUrl(page, perPage), headers);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, status: res.status, body, repos: out };
    }
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < perPage) break;
  }
  return { ok: true, status: 200, repos: out };
}

/**
 * Whether to route repo-list pagination through `gh api --paginate` instead
 * of REST. Reads the env var at call time so tests can toggle it without
 * re-importing the module.
 *
 * @returns {boolean}
 */
export function isGhPaginateEnabled() {
  return (process.env.PAGINATE_VIA_GH || '').toLowerCase() === 'true';
}

// Paginate via `gh api --paginate`. Returns same { ok, status, repos } shape
// as paginateRepos. gh outputs one JSON array per page on its own line; we
// concatenate them. Runs async (spawn) so the event loop is not blocked.
function paginateViaGh(ghPath, token) {
  const args = ['api', '--paginate', ghPath];
  if (token) args.push('--header', `Authorization: Bearer ${token}`);
  return new Promise((resolve) => {
    const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      settle({ ok: false, status: 500, repos: [] });
    }, 60000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      if (code !== 0) {
        const m = stderr.match(/HTTP (\d{3})/);
        settle({ ok: false, status: m ? Number(m[1]) : 500, repos: [] });
        return;
      }
      const repos = [];
      for (const line of stdout.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t);
          if (Array.isArray(parsed)) repos.push(...parsed);
        } catch { /* skip malformed line */ }
      }
      settle({ ok: true, status: 200, repos });
    });
    child.on('error', () => settle({ ok: false, status: 500, repos: [] }));
  });
}

// Run `gh <args>` and resolve with its full stdout string. Rejects on non-zero
// exit, spawn error, or timeout. Used by enrichRepos for single-shot GraphQL calls.
function spawnGhText(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    let settled = false;
    const settle = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      child.kill();
      settle(() => reject(new Error('gh timeout')));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('close', (code) => {
      if (code !== 0) settle(() => reject(new Error(`gh exited ${code}`)));
      else settle(() => resolve(stdout));
    });
    child.on('error', (err) => settle(() => reject(err)));
  });
}

const selfReposUrl = (page, perPage) =>
  `${GITHUB_API}/user/repos?per_page=${perPage}&page=${page}&affiliation=owner&visibility=all&sort=full_name`;
const orgReposUrl = (owner) => (page, perPage) =>
  `${GITHUB_API}/orgs/${encodeURIComponent(owner)}/repos?per_page=${perPage}&page=${page}&type=all&sort=full_name`;
const userReposUrl = (owner) => (page, perPage) =>
  `${GITHUB_API}/users/${encodeURIComponent(owner)}/repos?per_page=${perPage}&page=${page}&type=owner&sort=full_name`;

const selfReposGhPath = '/user/repos?per_page=100&affiliation=owner&visibility=all&sort=full_name';
const orgReposGhPath = (owner) => `/orgs/${encodeURIComponent(owner)}/repos?per_page=100&type=all&sort=full_name`;
const userReposGhPath = (owner) => `/users/${encodeURIComponent(owner)}/repos?per_page=100&type=owner&sort=full_name`;

// Is the authenticated token a member of this org? 200 = member, anything else
// (404 not-a-member, 403 forbidden) = no, so we only see public repos.
async function isOrgMember(owner, headers) {
  const res = await ghGet(`${GITHUB_API}/user/memberships/orgs/${encodeURIComponent(owner)}`, headers);
  if (res.status !== 200) return false;
  const m = await res.json().catch(() => null);
  return m?.state === 'active' || m?.state === 'pending';
}

// Resolve one configured owner to a list of repos, recording warnings when we
// can only reach public repositories. When PAGINATE_VIA_GH is enabled, repo
// list pages go through `gh api --paginate`; org/membership detection stays
// on REST so the 404/403 status-sensitive logic is unaffected.
async function fetchOwnerRepos(owner, viewerLogin, token, headers) {
  // The token's own account → use /user/repos so private repos are included.
  if (viewerLogin && owner.toLowerCase() === viewerLogin) {
    const r = await (isGhPaginateEnabled()
      ? paginateViaGh(selfReposGhPath, token)
      : paginateRepos(selfReposUrl, headers));
    if (!r.ok) throw repoListError(r);
    return { repos: r.repos, scope: 'self' };
  }

  // Try the org endpoint first (exposes private org repos when authorized).
  const orgRes = await (isGhPaginateEnabled()
    ? paginateViaGh(orgReposGhPath(owner), token)
    : paginateRepos(orgReposUrl(owner), headers));

  if (orgRes.ok) {
    const member = await isOrgMember(owner, headers);
    if (!member) {
      sourceStatus.warnings.push(
        `Token is not a member of organization "${owner}" — loaded its public repositories only.`
      );
      return { repos: orgRes.repos, scope: 'public' };
    }
    return { repos: orgRes.repos, scope: 'member' };
  }

  // Not an org (404) → it's a user account; load their public repos.
  if (orgRes.status === 404) {
    const userRes = await (isGhPaginateEnabled()
      ? paginateViaGh(userReposGhPath(owner), token)
      : paginateRepos(userReposUrl(owner), headers));
    if (!userRes.ok) throw repoListError(userRes);
    return { repos: userRes.repos, scope: 'public' };
  }

  // Forbidden for the org listing → fall back to whatever is public.
  if (orgRes.status === 403) {
    sourceStatus.warnings.push(
      `Token is not authorized for organization "${owner}" (403) — loaded its public repositories only.`
    );
    const userRes = await (isGhPaginateEnabled()
      ? paginateViaGh(userReposGhPath(owner), token)
      : paginateRepos(userReposUrl(owner), headers));
    return { repos: userRes.ok ? userRes.repos : [], scope: 'public' };
  }

  throw repoListError(orgRes);
}

// Resolve the viewer login for a given token (cached so we don't hit /user
// once per owner when many owners share the same token).
async function getViewerLogin(token, cache) {
  if (cache.has(token)) return cache.get(token);
  const meRes = await ghGet(`${GITHUB_API}/user`, buildHeaders(token));
  let login = null;
  if (meRes.ok) {
    const me = await meRes.json().catch(() => null);
    login = me?.login ? String(me.login).toLowerCase() : null;
  }
  cache.set(token, login);
  return login;
}

async function fetchConfiguredOwners(owners, resolveOwnerToken) {
  const loginCache = new Map();
  const byId = new Map();
  for (const owner of owners) {
    const { token } = resolveOwnerToken(owner);
    if (!token) {
      sourceStatus.warnings.push(`No token available for owner "${owner}" — skipped.`);
      sourceStatus.owners.push({ owner, count: 0, scope: 'error' });
      continue;
    }
    const headers = buildHeaders(token);
    const viewerLogin = await getViewerLogin(token, loginCache);
    try {
      const { repos, scope } = await fetchOwnerRepos(owner, viewerLogin, token, headers);
      for (const r of repos) byId.set(r.id, r);
      sourceStatus.owners.push({ owner, count: repos.length, scope });
    } catch (e) {
      // Fatal conditions abort the whole sync; everything else is per-owner.
      if (/invalid or expired|rate limit/i.test(e.message)) throw e;
      sourceStatus.warnings.push(`Could not load "${owner}": ${e.message}`);
      sourceStatus.owners.push({ owner, count: 0, scope: 'error' });
    }
  }
  return [...byId.values()];
}

function mapRepo(r) {
  return {
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    owner: r.owner?.login ?? (r.full_name ? r.full_name.split('/')[0] : null),
    owner_type: r.owner?.type ?? null,
    description: r.description,
    private: r.private,
    archived: r.archived,
    fork: r.fork,
    html_url: r.html_url,
    language: r.language,
    pushed_at: r.pushed_at,
    updated_at: r.updated_at,
    stargazers_count: r.stargazers_count,
    open_issues_count: r.open_issues_count,
    // Cheap enrichment: these all ship in the REST repos-list response, so they
    // cost no extra requests. Richer fields (open-PR count, CI status, latest
    // release, last-commit) need per-repo gh api/GraphQL calls — deferred.
    forks_count: r.forks_count ?? 0,
    default_branch: r.default_branch ?? null,
    topics: Array.isArray(r.topics) ? r.topics : [],
    license: r.license?.spdx_id ?? r.license?.name ?? null,
  };
}

// ---- Per-repo enrichment via gh api graphql --------------------------------
// Opt-in (ENRICH_METADATA=true). Runs after the repo list is fetched; the
// results live in memory alongside repoCache and are merged into buildPayload.

const ENRICH_BATCH = 25;

function buildEnrichQuery(repos) {
  const fragment = `
    pullRequests(states: OPEN) { totalCount }
    releases(first: 1, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes { tagName publishedAt }
    }
    defaultBranchRef {
      target {
        ... on Commit {
          committedDate
          author { name }
          statusCheckRollup { state }
        }
      }
    }`;
  const parts = repos.map((r) => {
    const [owner, name] = r.full_name.split('/');
    return `r${r.id}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${fragment} }`;
  });
  return `query { ${parts.join('\n')} }`;
}

function parseEnrichData(data, repos) {
  const out = new Map();
  for (const r of repos) {
    const node = data[`r${r.id}`];
    if (!node) continue;
    out.set(r.id, {
      open_prs: node.pullRequests?.totalCount ?? null,
      latest_release: node.releases?.nodes?.[0]
        ? { tag: node.releases.nodes[0].tagName, published_at: node.releases.nodes[0].publishedAt }
        : null,
      last_commit: node.defaultBranchRef?.target?.committedDate
        ? { date: node.defaultBranchRef.target.committedDate, author: node.defaultBranchRef.target.author?.name ?? null }
        : null,
      ci_status: node.defaultBranchRef?.target?.statusCheckRollup?.state ?? null,
    });
  }
  return out;
}

/**
 * Enriches a repo list with per-repo GraphQL data by batching up to 25 repos
 * per `gh api graphql` call. Fields added per repo:
 *
 * | Field | Type | Description |
 * |---|---|---|
 * | `open_prs` | `number\|null` | Distinct open pull-request count |
 * | `latest_release` | `{tag, published_at}\|null` | Most recent release tag |
 * | `last_commit` | `{date, author}\|null` | Default-branch last commit |
 * | `ci_status` | `'SUCCESS'\|'FAILURE'\|'ERROR'\|'PENDING'\|null` | Default-branch CI rollup |
 *
 * Batches that fail (gh unavailable, permission denied, JSON parse error) are
 * skipped silently so the board never hard-errors.
 *
 * @param {object[]} repos - Mapped repo objects with `id` and `full_name`.
 * @param {string|null} token - GitHub token to pass via `--header`. If falsy, gh's own auth is used.
 * @returns {Map<number, {open_prs: number|null, latest_release: object|null, last_commit: object|null, ci_status: string|null}>}
 */
export async function enrichRepos(repos, token) {
  const out = new Map();
  if (!repos.length) return out;
  for (let i = 0; i < repos.length; i += ENRICH_BATCH) {
    const batch = repos.slice(i, i + ENRICH_BATCH);
    const query = buildEnrichQuery(batch);
    try {
      const args = ['api', 'graphql'];
      if (token) args.push('--header', `Authorization: Bearer ${token}`);
      args.push('-f', `query=${query}`);
      const raw = await spawnGhText(args, 30000);
      const parsed = JSON.parse(raw);
      if (parsed?.data) {
        for (const [id, val] of parseEnrichData(parsed.data, batch)) {
          out.set(id, val);
        }
      }
    } catch {
      // gh unavailable, query failed, or JSON parse error — skip this batch
    }
  }
  return out;
}

/**
 * Fetches repositories for the dashboard, respecting `GITHUB_OWNERS`.
 *
 * - **No `GITHUB_OWNERS`**: loads the token owner's full repo set (including
 *   private + archived) via `/user/repos`.
 * - **One or more owners** (comma list or JSON array): each owner is resolved
 *   individually — the token owner's own login pulls private repos; orgs the
 *   token belongs to pull private + public; other orgs and plain users pull
 *   public only (a warning is added to {@link sourceStatus}).
 *
 * Updates {@link rateLimit}, {@link sourceStatus}, and {@link authStatus} as a
 * side-effect.
 *
 * @returns {Promise<object[]>} Array of mapped repo objects (see `mapRepo`).
 * @throws {Error} If no token is available, the token is invalid (401), or the
 *   rate limit is exhausted (403 with `remaining=0`).
 */
export async function fetchAllRepos(ownersOverride = undefined) {
  const resolveOwnerToken = buildResolveOwnerToken();
  const { token, source } = resolveOwnerToken(null);
  authStatus.source = source;
  authStatus.present = Boolean(token);
  if (!token) {
    throw new Error(
      'No GitHub token found. Set GITHUB_TOKEN in your .env, run `gh auth login`, or add a token via the tokens API.'
    );
  }

  assertRateBudget();

  const headers = buildHeaders(token);
  sourceStatus.owners = [];
  sourceStatus.warnings = [];

  const owners = ownersOverride !== undefined
    ? (Array.isArray(ownersOverride) ? ownersOverride : parseOwners(String(ownersOverride ?? '')))
    : parseOwners(process.env.GITHUB_OWNERS);

  let raw;
  if (owners.length === 0) {
    const r = await (isGhPaginateEnabled()
      ? paginateViaGh(selfReposGhPath, token)
      : paginateRepos(selfReposUrl, headers));
    if (!r.ok) throw repoListError(r);
    raw = r.repos;
    sourceStatus.owners.push({ owner: null, count: raw.length, scope: 'self' });
  } else {
    raw = await fetchConfiguredOwners(owners, resolveOwnerToken);
  }

  // gh api --paginate doesn't update rateLimit headers; do one REST probe.
  if (isGhPaginateEnabled()) {
    try {
      const rl = await ghGet(`${GITHUB_API}/rate_limit`, headers);
      if (rl.ok) parseRateLimitHeaders(rl);
    } catch { /* best effort — don't fail the sync */ }
  }

  // A clean fetch proves the token is valid.
  rateLimit.authInvalid = false;

  return raw.map(mapRepo);
}
