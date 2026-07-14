/**
 * Shared test utilities for e2e specs.
 *
 * makeRepos / apiPayload / mockApi are consumed by both smoke.spec.js (desktop)
 * and mobile.spec.js (≤640 px viewport). All /api/* routes used by the app are
 * mocked here so individual test files don't see unexpected 404s in the console.
 */

export const DEFAULT_INACTIVITY = 7;

export function makeRepos() {
  return [
    {
      id: 1,
      name: "alpha-repo",
      full_name: "user/alpha-repo",
      html_url: "https://github.com/user/alpha-repo",
      description: "Alpha test repo",
      private: false,
      archived: false,
      fork: false,
      language: "JavaScript",
      pushed_at: "2026-01-01T00:00:00.000Z",
      owner: "user",
      checkedAgeDays: 3,
      dueInDays: 0,
      needsCheckToday: true,
      column: "day-0",
      boardOffset: 0,
      position: 0,
      inactivity_days: null,
      effective_inactivity_days: DEFAULT_INACTIVITY,
      priority: null,
      priority_set_at: null,
      tags: [],
      ignored: false,
      notice_count: 0,
      latest_notice: null,
      stargazers_count: 5,
      open_issues_count: 0,
      forks_count: 0,
    },
    {
      id: 2,
      name: "beta-repo",
      full_name: "user/beta-repo",
      html_url: "https://github.com/user/beta-repo",
      description: "Beta test repo",
      private: false,
      archived: false,
      fork: false,
      language: "Python",
      pushed_at: "2026-01-02T00:00:00.000Z",
      owner: "user",
      checkedAgeDays: 1,
      dueInDays: 2,
      needsCheckToday: false,
      column: "day-1",
      boardOffset: 1,
      position: 0,
      inactivity_days: null,
      effective_inactivity_days: DEFAULT_INACTIVITY,
      priority: null,
      priority_set_at: null,
      tags: [],
      ignored: false,
      notice_count: 0,
      latest_notice: null,
      stargazers_count: 0,
      open_issues_count: 2,
      forks_count: 0,
    },
    {
      id: 3,
      name: "gamma-repo",
      full_name: "user/gamma-repo",
      html_url: "https://github.com/user/gamma-repo",
      description: "Gamma test repo",
      private: false,
      archived: false,
      fork: false,
      language: "Go",
      pushed_at: "2026-01-03T00:00:00.000Z",
      owner: "user",
      checkedAgeDays: 0,
      dueInDays: 1,
      needsCheckToday: false,
      column: "day-2",
      boardOffset: 2,
      position: 0,
      inactivity_days: null,
      effective_inactivity_days: DEFAULT_INACTIVITY,
      priority: null,
      priority_set_at: null,
      tags: [],
      ignored: false,
      notice_count: 0,
      latest_notice: null,
      stargazers_count: 10,
      open_issues_count: 0,
      forks_count: 1,
    },
  ];
}

export function apiPayload(repos) {
  return {
    repos,
    cacheReady: true,
    defaultInactivityDays: DEFAULT_INACTIVITY,
    dayRolloverHour: 4,
    lastFetch: "2026-06-12T10:00:00.000Z",
    username: "user",
    tokenPresent: true,
    lastError: null,
    syncing: false,
    rateLimit: {
      remaining: 4500,
      limit: 5000,
      used: 500,
      reset: null,
      authInvalid: false,
      lastChecked: null,
    },
    sourceStatus: {
      owners: [{ owner: "user", count: 3, scope: "self" }],
      warnings: [],
    },
    authStatus: { source: "env", present: true },
  };
}

/**
 * Register mocked /api/* routes on the page and return the live state object.
 * Mutations update state in-place so subsequent GET /api/repos reflects them.
 */
export async function mockApi(page) {
  const state = {
    repos: makeRepos(),
    notices: {}, // repoId (number) → notice[]
    nextNoticeId: 1,
  };

  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    const ok = (data = { ok: true }) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });

    // GET /api/repos
    if (method === "GET" && path === "/api/repos") {
      return ok(apiPayload(state.repos));
    }

    // POST /api/refresh
    if (method === "POST" && path === "/api/refresh") {
      return ok({
        ok: true,
        queued: false,
        syncing: false,
        cacheReady: true,
        lastFetch: "2026-06-12T10:00:00.000Z",
      });
    }

    // POST /api/reorder
    if (method === "POST" && path === "/api/reorder") return ok();

    // GET /api/notices (all-repo notices dialog)
    if (method === "GET" && path === "/api/notices") {
      return ok(Object.values(state.notices).flat());
    }

    // GET /api/reports
    if (method === "GET" && path === "/api/reports") return ok([]);

    // GET /api/prefs — app hydrates persisted view preferences on load
    if (method === "GET" && path === "/api/prefs") return ok({ prefs: null });

    // PUT /api/prefs — app persists view preference changes
    if (method === "PUT" && path === "/api/prefs") return ok();

    // GET /api/settings
    if (method === "GET" && path === "/api/settings") {
      return ok({
        settings: {
          defaultInactivityDays: DEFAULT_INACTIVITY,
          syncIntervalMinutes: 60,
          githubOwners: "",
        },
        defaults: {
          defaultInactivityDays: DEFAULT_INACTIVITY,
          syncIntervalMinutes: 60,
          githubOwners: "",
        },
      });
    }

    // PUT /api/settings
    if (method === "PUT" && path === "/api/settings") return ok();

    // Per-repo routes /api/repos/:id/...
    const m = path.match(/^\/api\/repos\/(\d+)\/(.+)$/);
    if (m) {
      const id = parseInt(m[1], 10);
      const action = m[2];
      const repo = state.repos.find((r) => r.id === id);

      if (action === "check" && method === "POST") {
        const body = route.request().postDataJSON();
        const daysAgo = body?.daysAgo ?? 0;
        if (repo) {
          const offset = Math.min(
            Math.max(0, DEFAULT_INACTIVITY - daysAgo),
            DEFAULT_INACTIVITY - 1,
          );
          repo.column = `day-${offset}`;
          repo.boardOffset = offset;
          repo.checkedAgeDays = daysAgo;
          repo.dueInDays = Math.max(0, DEFAULT_INACTIVITY - daysAgo);
          repo.needsCheckToday = daysAgo >= DEFAULT_INACTIVITY;
        }
        return ok();
      }

      if (action === "ignore" && method === "POST") {
        const body = route.request().postDataJSON();
        if (repo) repo.ignored = body?.ignored ?? false;
        return ok();
      }

      if (action === "snooze" && method === "POST") {
        const body = route.request().postDataJSON();
        const days = body?.days ?? 1;
        if (repo) {
          const offset = Math.min(Math.max(1, days), DEFAULT_INACTIVITY - 1);
          repo.column = `day-${offset}`;
          repo.boardOffset = offset;
          repo.needsCheckToday = false;
          repo.dueInDays = offset;
        }
        return ok();
      }

      if (action === "notices") {
        if (method === "POST") {
          const body = route.request().postDataJSON();
          const notice = {
            id: state.nextNoticeId++,
            repo_id: id,
            full_name: repo?.full_name ?? "",
            body: body.body,
            created_at: new Date().toISOString(),
          };
          if (!state.notices[id]) state.notices[id] = [];
          state.notices[id].push(notice);
          if (repo) {
            repo.notice_count = (repo.notice_count || 0) + 1;
            repo.latest_notice = {
              body: notice.body,
              created_at: notice.created_at,
            };
          }
          return ok();
        }
        if (method === "GET") {
          return ok(state.notices[id] || []);
        }
      }

      if (action === "priority" && method === "POST") {
        const body = route.request().postDataJSON();
        if (repo) repo.priority = body?.priority ?? null;
        return ok();
      }

      if (action === "clear" && method === "POST") {
        if (repo) {
          repo.column = "day-0";
          repo.boardOffset = 0;
          repo.needsCheckToday = true;
        }
        return ok();
      }

      if (action === "touch" && method === "POST") {
        if (repo) {
          repo.column = `day-${DEFAULT_INACTIVITY - 1}`;
          repo.boardOffset = DEFAULT_INACTIVITY - 1;
          repo.checkedAgeDays = 0;
          repo.dueInDays = DEFAULT_INACTIVITY;
          repo.needsCheckToday = false;
        }
        return ok();
      }

      if (action === "inactivity" && method === "POST") return ok();
      if (action === "tags" || action.startsWith("tags/")) return ok([]);
      if (action === "flags" || action.startsWith("flags/")) return ok([]);
    }

    // Per-notice delete: /api/notices/:id
    if (method === "DELETE" && path.match(/^\/api\/notices\/\d+$/)) return ok();

    // Tag delete: /api/tags/:tag
    if (method === "DELETE" && path.match(/^\/api\/tags\//)) return ok();

    route.fulfill({ status: 404, body: "Not found in mock" });
  });

  return state;
}
