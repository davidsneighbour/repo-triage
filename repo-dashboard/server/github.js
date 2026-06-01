const GITHUB_API = 'https://api.github.com';

/**
 * Fetch ALL repositories the configured token can see.
 *
 * - Default (no GITHUB_USERNAME): the authenticated token owner's repos,
 *   including private + archived (this is what you almost certainly want).
 * - With GITHUB_USERNAME set: that user/org's PUBLIC repos only (GitHub will
 *   not expose someone else's private repos no matter the token).
 */
export async function fetchAllRepos() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set. Put it in ~/.env and start with: docker compose --env-file ~/.env up');
  }

  const username = (process.env.GITHUB_USERNAME || '').trim();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'repo-dashboard',
  };

  const out = [];
  const perPage = 100;
  for (let page = 1; page <= 50; page++) {
    const url = username
      ? `${GITHUB_API}/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&page=${page}&type=owner&sort=full_name`
      : `${GITHUB_API}/user/repos?per_page=${perPage}&page=${page}&affiliation=owner&visibility=all&sort=full_name`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
    }
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < perPage) break;
  }

  return out.map((r) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
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
  }));
}
