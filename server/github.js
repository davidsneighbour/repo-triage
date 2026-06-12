import { execFileSync } from 'node:child_process';

const GITHUB_API = 'https://api.github.com';

// ---- Shared rate-limit state -----------------------------------------------
// Exported so server/index.js can include it in every API response.
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
export const sourceStatus = {
  owners: [],   // [{ owner, count, scope }] — scope: self|member|public|error
  warnings: [], // human-readable, non-fatal messages (e.g. org access fell back to public)
};

// Which credential the last token resolution used, surfaced in /api/repos.
export const authStatus = {
  source: null,   // 'env' (GITHUB_TOKEN) | 'gh' (gh auth token) | null
  present: false, // whether a usable token was resolved
};

export function parseRateLimitHeaders(res, target = rateLimit) {
  const h = (k) => res.headers.get(k);
  if (h('x-ratelimit-limit') !== null) target.limit = Number(h('x-ratelimit-limit'));
  if (h('x-ratelimit-remaining') !== null) target.remaining = Number(h('x-ratelimit-remaining'));
  if (h('x-ratelimit-used') !== null) target.used = Number(h('x-ratelimit-used'));
  if (h('x-ratelimit-reset') !== null) target.reset = Number(h('x-ratelimit-reset'));
  target.lastChecked = new Date().toISOString();
}

/**
 * Parse the configured owner list. Accepts either a comma/space separated
 * string ("a, b c") or a JSON array string ('["a","b"]'). Returns a
 * de-duplicated (case-insensitive) array of owner logins in input order.
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

// Ask the GitHub CLI for the user's token. Returns null if gh is missing, not
// logged in, or errors — so resolveToken can fall through cleanly.
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

// Prefer an explicit GITHUB_TOKEN; otherwise reuse the user's `gh` login so no
// PAT is needed when they've already run `gh auth login`.
export function resolveToken() {
  const env = (process.env.GITHUB_TOKEN || '').trim();
  if (env) return { token: env, source: 'env' };
  const gh = ghAuthToken();
  if (gh) return { token: gh, source: 'gh' };
  return { token: null, source: null };
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

const selfReposUrl = (page, perPage) =>
  `${GITHUB_API}/user/repos?per_page=${perPage}&page=${page}&affiliation=owner&visibility=all&sort=full_name`;
const orgReposUrl = (owner) => (page, perPage) =>
  `${GITHUB_API}/orgs/${encodeURIComponent(owner)}/repos?per_page=${perPage}&page=${page}&type=all&sort=full_name`;
const userReposUrl = (owner) => (page, perPage) =>
  `${GITHUB_API}/users/${encodeURIComponent(owner)}/repos?per_page=${perPage}&page=${page}&type=owner&sort=full_name`;

// Is the authenticated token a member of this org? 200 = member, anything else
// (404 not-a-member, 403 forbidden) = no, so we only see public repos.
async function isOrgMember(owner, headers) {
  const res = await ghGet(`${GITHUB_API}/user/memberships/orgs/${encodeURIComponent(owner)}`, headers);
  if (res.status !== 200) return false;
  const m = await res.json().catch(() => null);
  return m?.state === 'active' || m?.state === 'pending';
}

// Resolve one configured owner to a list of repos, recording warnings when we
// can only reach public repositories.
async function fetchOwnerRepos(owner, viewerLogin, headers) {
  // The token's own account → use /user/repos so private repos are included.
  if (viewerLogin && owner.toLowerCase() === viewerLogin) {
    const r = await paginateRepos(selfReposUrl, headers);
    if (!r.ok) throw repoListError(r);
    return { repos: r.repos, scope: 'self' };
  }

  // Try the org endpoint first (exposes private org repos when authorized).
  const orgRes = await paginateRepos(orgReposUrl(owner), headers);

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
    const userRes = await paginateRepos(userReposUrl(owner), headers);
    if (!userRes.ok) throw repoListError(userRes);
    return { repos: userRes.repos, scope: 'public' };
  }

  // Forbidden for the org listing → fall back to whatever is public.
  if (orgRes.status === 403) {
    sourceStatus.warnings.push(
      `Token is not authorized for organization "${owner}" (403) — loaded its public repositories only.`
    );
    const userRes = await paginateRepos(userReposUrl(owner), headers);
    return { repos: userRes.ok ? userRes.repos : [], scope: 'public' };
  }

  throw repoListError(orgRes);
}

async function fetchConfiguredOwners(owners, headers) {
  // The viewer's login lets us pull private repos for the token owner itself.
  let viewerLogin = null;
  const meRes = await ghGet(`${GITHUB_API}/user`, headers);
  if (meRes.ok) {
    const me = await meRes.json().catch(() => null);
    viewerLogin = me?.login ? String(me.login).toLowerCase() : null;
  }

  const byId = new Map();
  for (const owner of owners) {
    try {
      const { repos, scope } = await fetchOwnerRepos(owner, viewerLogin, headers);
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
 * Enrich repo list with per-repo GraphQL data (open PR count, latest release,
 * last commit, CI status). Batches ENRICH_BATCH repos per `gh api graphql` call.
 * Returns a Map<repoId, enrichmentObject>. Silently skips batches that fail
 * (gh unavailable, permission denied, etc.) so the board never hard-errors.
 */
export function enrichRepos(repos, token) {
  const out = new Map();
  if (!repos.length) return out;
  for (let i = 0; i < repos.length; i += ENRICH_BATCH) {
    const batch = repos.slice(i, i + ENRICH_BATCH);
    const query = buildEnrichQuery(batch);
    try {
      const args = ['api', 'graphql'];
      if (token) args.push('--header', `Authorization: Bearer ${token}`);
      args.push('-f', `query=${query}`);
      const raw = execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 30000,
      });
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
 * Fetch repositories for the dashboard.
 *
 * - No GITHUB_OWNERS / GITHUB_USERNAME: the authenticated token owner's repos,
 *   including private + archived.
 * - One or more owners configured (comma list or JSON array via GITHUB_OWNERS,
 *   or a single GITHUB_USERNAME): each is loaded individually — the token
 *   owner's own login pulls private repos; orgs you belong to pull private +
 *   public; orgs you don't, and plain users, pull public only (with a warning).
 */
export async function fetchAllRepos() {
  const { token, source } = resolveToken();
  authStatus.source = source;
  authStatus.present = Boolean(token);
  if (!token) {
    throw new Error(
      'No GitHub token found. Set GITHUB_TOKEN in your .env, or run `gh auth login` so the dashboard can use `gh auth token`.'
    );
  }

  assertRateBudget();

  const headers = buildHeaders(token);
  sourceStatus.owners = [];
  sourceStatus.warnings = [];

  const owners = parseOwners(process.env.GITHUB_OWNERS ?? process.env.GITHUB_USERNAME);

  let raw;
  if (owners.length === 0) {
    const r = await paginateRepos(selfReposUrl, headers);
    if (!r.ok) throw repoListError(r);
    raw = r.repos;
    sourceStatus.owners.push({ owner: null, count: raw.length, scope: 'self' });
  } else {
    raw = await fetchConfiguredOwners(owners, headers);
  }

  // A clean fetch proves the token is valid.
  rateLimit.authInvalid = false;

  return raw.map(mapRepo);
}
