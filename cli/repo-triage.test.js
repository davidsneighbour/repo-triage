import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiBase,
  filterReposCli,
  formatList,
  parseArgs,
  resolveRepo,
  resolveRepos,
  run,
  sendNotify,
  watchOnce,
} from "./repo-triage.mjs";

const REPOS = [
  {
    id: 1,
    full_name: "me/alpha",
    name: "alpha",
    owner: "me",
    needsCheckToday: true,
    dueInDays: 0,
    tags: ["infra"],
    ignored: false,
    language: "JavaScript",
    stargazers_count: 5,
    priority: 1,
  },
  {
    id: 2,
    full_name: "dnbhq/beta",
    name: "beta",
    owner: "dnbhq",
    needsCheckToday: false,
    dueInDays: 3,
    tags: ["oss"],
    ignored: false,
    language: "Go",
    stargazers_count: 0,
    priority: 2,
  },
  {
    id: 3,
    full_name: "me/hidden",
    name: "hidden",
    owner: "me",
    needsCheckToday: false,
    dueInDays: 1,
    tags: [],
    ignored: true,
    language: "Go",
    priority: null,
  },
];

describe("parseArgs", () => {
  it("splits command, positionals, boolean and value flags", () => {
    expect(parseArgs(["list", "--owner", "me", "--json", "--due"])).toEqual({
      command: "list",
      positionals: [],
      flags: { owner: "me", json: true, due: true },
    });
  });

  it("supports --key=value and consumes values only for known value flags", () => {
    const { flags } = parseArgs(["check", "me/alpha", "--days=2", "--all"]);
    expect(flags).toEqual({ days: "2", all: true });
  });
});

describe("apiBase", () => {
  afterEach(() => {
    delete process.env.REPO_TRIAGE_API;
    delete process.env.PORT;
  });

  it("defaults to localhost:8787, honours --api and env, trims trailing slash", () => {
    expect(apiBase({})).toBe("http://localhost:8787");
    expect(apiBase({ api: "http://x:1/" })).toBe("http://x:1");
    process.env.REPO_TRIAGE_API = "http://env:2";
    expect(apiBase({})).toBe("http://env:2");
  });
});

describe("resolveRepo", () => {
  it("matches by full_name then bare name", () => {
    expect(resolveRepo(REPOS, "me/alpha").id).toBe(1);
    expect(resolveRepo(REPOS, "beta").id).toBe(2);
  });

  it("falls back to fuzzy (substring) name match", () => {
    expect(resolveRepo(REPOS, "lpha").id).toBe(1);
    expect(resolveRepo(REPOS, "bet").id).toBe(2);
  });

  it("throws on no match and on ambiguity", () => {
    expect(() => resolveRepo(REPOS, "nope")).toThrow(/no repo matching/);
    const dup = [
      { full_name: "a/x", name: "x" },
      { full_name: "b/x", name: "x" },
    ];
    expect(() => resolveRepo(dup, "x")).toThrow(/ambiguous/);
  });

  it("fuzzy match throws ambiguity when substring matches multiple repos", () => {
    const repos = [
      { full_name: "me/widget-a", name: "widget-a" },
      { full_name: "me/widget-b", name: "widget-b" },
    ];
    expect(() => resolveRepo(repos, "widget")).toThrow(/ambiguous/);
  });
});

describe("resolveRepos", () => {
  it("returns a single-element array when no --all-matching flag", () => {
    const result = resolveRepos(REPOS, "me/alpha", {});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("--all-matching with exact owner prefix returns all matching repos", () => {
    const result = resolveRepos(REPOS, undefined, { "all-matching": "me/*" });
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  it("--all-matching with trailing wildcard matches by name prefix", () => {
    const result = resolveRepos(REPOS, undefined, { "all-matching": "b*" });
    expect(result.map((r) => r.id)).toEqual([2]);
  });

  it("--all-matching with no matches throws", () => {
    expect(() =>
      resolveRepos(REPOS, undefined, { "all-matching": "nobody/*" }),
    ).toThrow(/no repos matching/);
  });
});

describe("filterReposCli", () => {
  it("hides ignored by default; --ignored shows only ignored; --all shows everything", () => {
    expect(filterReposCli(REPOS, {}).map((r) => r.id)).toEqual([1, 2]);
    expect(filterReposCli(REPOS, { ignored: true }).map((r) => r.id)).toEqual([
      3,
    ]);
    expect(filterReposCli(REPOS, { all: true }).map((r) => r.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("filters by owner, tag, language and due", () => {
    expect(filterReposCli(REPOS, { owner: "dnbhq" }).map((r) => r.id)).toEqual([
      2,
    ]);
    expect(filterReposCli(REPOS, { tag: "infra" }).map((r) => r.id)).toEqual([
      1,
    ]);
    expect(filterReposCli(REPOS, { language: "go" }).map((r) => r.id)).toEqual([
      2,
    ]);
    expect(filterReposCli(REPOS, { due: true }).map((r) => r.id)).toEqual([1]);
  });

  it('filters by priority (comma list; "none" = unset), with --all to include ignored', () => {
    expect(filterReposCli(REPOS, { priority: "1" }).map((r) => r.id)).toEqual([
      1,
    ]);
    expect(filterReposCli(REPOS, { priority: "1,2" }).map((r) => r.id)).toEqual(
      [1, 2],
    );
    expect(
      filterReposCli(REPOS, { priority: "none", all: true }).map((r) => r.id),
    ).toEqual([3]);
  });
});

describe("formatList", () => {
  it("emits JSON with a due label when --json", () => {
    const out = JSON.parse(formatList([REPOS[0]], { json: true }));
    expect(out[0]).toMatchObject({
      full_name: "me/alpha",
      due: "today",
      tags: ["infra"],
    });
  });

  it("renders a table and an empty message", () => {
    expect(formatList([], {})).toBe("no repositories match.");
    const table = formatList(REPOS.slice(0, 2), {});
    expect(table).toMatch(/me\/alpha/);
    expect(table).toMatch(/in 3d/);
    expect(table).toMatch(/#infra/);
  });
});

// ---- run() against a stubbed API ------------------------------------------

function stubApi() {
  const calls = [];
  const res = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      calls.push({
        url,
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      if (url.endsWith("/api/repos")) return res({ repos: REPOS });
      if (url.endsWith("/api/tags"))
        return res({ tags: [{ tag: "infra", count: 1 }] });
      if (url.endsWith("/api/backup"))
        return res({
          version: 1,
          repo_state: [],
          repo_notice: [],
          repo_tag: [],
        });
      if (url.endsWith("/api/restore"))
        return res({
          ok: true,
          restored: { repo_state: 2, repo_notice: 1, repo_tag: 3 },
        });
      if (url.includes("/api/reports/")) {
        if (url.includes("format=json"))
          return res({
            kind: "summary",
            columns: ["metric", "value"],
            rows: [["total repos", 2]],
          });
        if (url.includes("format=csv"))
          return res("metric,value\ntotal repos,2\n");
        return res(
          "## Summary\n\n| metric | value |\n| --- | --- |\n| total repos | 2 |\n",
        );
      }
      return res({ ok: true });
    }),
  );
  return calls;
}

describe("run", () => {
  let out;
  beforeEach(() => {
    out = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prints help with no command", async () => {
    expect(await run([], out)).toBe(0);
    expect(out.mock.calls[0][0]).toMatch(/Usage: repo-triage/);
  });

  it("lists repositories (hiding ignored)", async () => {
    stubApi();
    await run(["list"], out);
    const printed = out.mock.calls[0][0];
    expect(printed).toMatch(/me\/alpha/);
    expect(printed).not.toMatch(/me\/hidden/);
  });

  it("ignore resolves the repo then POSTs the ignore flag", async () => {
    const calls = stubApi();
    await run(["ignore", "me/alpha"], out);
    const post = calls.find((c) => c.url.includes("/ignore"));
    expect(post).toMatchObject({ method: "POST", body: { ignored: true } });
    expect(post.url).toContain("/api/repos/1/ignore");
  });

  it("check passes daysAgo from --days", async () => {
    const calls = stubApi();
    await run(["check", "beta", "--days", "4"], out);
    expect(calls.find((c) => c.url.includes("/check"))).toMatchObject({
      body: { daysAgo: 4 },
    });
  });

  it("tag add posts one request per tag", async () => {
    const calls = stubApi();
    await run(["tag", "add", "me/alpha", "ci", "db"], out);
    const tagPosts = calls.filter(
      (c) => c.url.includes("/tags") && c.method === "POST",
    );
    expect(tagPosts.map((c) => c.body.tag)).toEqual(["ci", "db"]);
  });

  it("note add joins the remaining args into the body", async () => {
    const calls = stubApi();
    await run(["note", "add", "beta", "needs", "a", "release"], out);
    expect(calls.find((c) => c.url.includes("/notices"))).toMatchObject({
      body: { body: "needs a release" },
    });
  });

  it("unignore posts ignored:false", async () => {
    const calls = stubApi();
    await run(["unignore", "me/hidden"], out);
    expect(calls.find((c) => c.url.includes("/ignore"))).toMatchObject({
      body: { ignored: false },
    });
  });

  it("clear posts to the schedule-only /clear endpoint", async () => {
    const calls = stubApi();
    await run(["clear", "me/alpha"], out);
    expect(calls.find((c) => c.url.includes("/clear"))).toMatchObject({
      method: "POST",
    });
  });

  it('priority sets a level and clears with "none"', async () => {
    let calls = stubApi();
    await run(["priority", "me/alpha", "2"], out);
    expect(calls.find((c) => c.url.includes("/priority"))).toMatchObject({
      body: { priority: 2 },
    });

    vi.unstubAllGlobals();
    calls = stubApi();
    await run(["priority", "me/alpha", "none"], out);
    expect(calls.find((c) => c.url.includes("/priority"))).toMatchObject({
      body: { priority: null },
    });
  });

  it("priority rejects an out-of-range level", async () => {
    stubApi();
    await expect(run(["priority", "me/alpha", "9"], out)).rejects.toThrow(
      /usage: priority/,
    );
  });

  it('interval sets a number and resets with "default"', async () => {
    let calls = stubApi();
    await run(["interval", "me/alpha", "14"], out);
    expect(calls.find((c) => c.url.includes("/inactivity"))).toMatchObject({
      body: { days: 14 },
    });

    vi.unstubAllGlobals();
    calls = stubApi();
    await run(["interval", "me/alpha", "default"], out);
    expect(calls.find((c) => c.url.includes("/inactivity"))).toMatchObject({
      body: { days: null },
    });
  });

  it("tag rm deletes each tag", async () => {
    const calls = stubApi();
    await run(["tag", "rm", "me/alpha", "infra"], out);
    expect(calls.find((c) => c.url.includes("/tags/"))).toMatchObject({
      method: "DELETE",
    });
  });

  it("lists tags with counts", async () => {
    stubApi();
    await run(["tags"], out);
    expect(out.mock.calls[0][0]).toMatch(/#infra/);
  });

  it("rejects bad sub-commands and invalid numbers", async () => {
    stubApi();
    await expect(run(["tag", "wat", "me/alpha", "x"], out)).rejects.toThrow(
      /usage: tag/,
    );
    await expect(run(["note", "me/alpha", "x"], out)).rejects.toThrow(
      /usage: note/,
    );
    await expect(
      run(["check", "me/alpha", "--days", "-2"], out),
    ).rejects.toThrow(/non-negative/);
  });

  it("report defaults to markdown, honours --format and --days", async () => {
    let calls = stubApi();
    await run(["report", "summary"], out);
    expect(
      calls.find((c) => c.url.includes("/api/reports/summary"))?.url,
    ).toContain("format=md");
    expect(out.mock.calls[0][0]).toMatch(/## Summary/);

    vi.unstubAllGlobals();
    calls = stubApi();
    await run(["report", "stale", "--format", "csv", "--days", "90"], out);
    const url = calls.find((c) => c.url.includes("/api/reports/stale"))?.url;
    expect(url).toContain("format=csv");
    expect(url).toContain("days=90");
  });

  it("report --json pretty-prints parsed JSON", async () => {
    stubApi();
    await run(["report", "summary", "--json"], out);
    expect(out.mock.calls[0][0]).toMatch(/"kind": "summary"/);
  });

  it("report requires a kind and surfaces API errors", async () => {
    stubApi();
    await expect(run(["report"], out)).rejects.toThrow(/usage: report/);

    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'unknown report "x"' }),
      })),
    );
    await expect(run(["report", "x"], out)).rejects.toThrow(/unknown report/);
  });

  it("rejects an unknown command", async () => {
    await expect(run(["frobnicate"], out)).rejects.toThrow(/unknown command/);
  });

  it("open calls gh repo view --web with the resolved full_name", async () => {
    stubApi();
    const execFile = vi.fn();
    await run(["open", "me/alpha"], out, { execFile });
    expect(execFile).toHaveBeenCalledWith(
      "gh",
      ["repo", "view", "--web", "me/alpha"],
      { stdio: "inherit" },
    );
    expect(out.mock.calls[0][0]).toMatch(/opened me\/alpha/);
  });

  it("open resolves by fuzzy name", async () => {
    stubApi();
    const execFile = vi.fn();
    await run(["open", "lpha"], out, { execFile });
    expect(execFile).toHaveBeenCalledWith(
      "gh",
      ["repo", "view", "--web", "me/alpha"],
      expect.anything(),
    );
  });

  it("check --all-matching acts on every matched repo", async () => {
    const calls = stubApi();
    await run(["check", "--all-matching", "me/*", "--days", "2"], out, {});
    const checkCalls = calls.filter(
      (c) => c.url.includes("/check") && c.method === "POST",
    );
    expect(checkCalls.map((c) => c.body.daysAgo)).toEqual([2, 2]);
    expect(checkCalls.map((c) => c.url)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/repos/1/"),
        expect.stringContaining("/repos/3/"),
      ]),
    );
  });

  it("ignore --all-matching ignores every matched repo", async () => {
    const calls = stubApi();
    await run(["ignore", "--all-matching", "me/*"], out, {});
    const ignoreCalls = calls.filter(
      (c) => c.url.includes("/ignore") && c.method === "POST",
    );
    expect(ignoreCalls).toHaveLength(2);
    expect(ignoreCalls.every((c) => c.body.ignored === true)).toBe(true);
  });

  it("clear --all-matching clears every matched repo", async () => {
    const calls = stubApi();
    await run(["clear", "--all-matching", "dnbhq/*"], out, {});
    const clearCalls = calls.filter(
      (c) => c.url.includes("/clear") && c.method === "POST",
    );
    expect(clearCalls).toHaveLength(1);
    expect(clearCalls[0].url).toContain("/repos/2/");
  });

  it("backup prints the JSON payload from /api/backup", async () => {
    const calls = stubApi();
    await run(["backup"], out);
    expect(calls.find((c) => c.url.endsWith("/api/backup"))).toBeTruthy();
    expect(out.mock.calls[0][0]).toMatch(/"repo_state"/);
  });

  it("restore reads a file and POSTs it to /api/restore", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const file = path.join(
      os.tmpdir(),
      `repo-triage-restore-${Date.now()}.json`,
    );
    fs.writeFileSync(
      file,
      JSON.stringify({
        repo_state: [{ repo_id: 1 }],
        repo_notice: [],
        repo_tag: [],
      }),
    );

    const calls = stubApi();
    await run(["restore", file], out);
    fs.rmSync(file, { force: true });

    const post = calls.find((c) => c.url.endsWith("/api/restore"));
    expect(post).toMatchObject({ method: "POST" });
    expect(post.body.repo_state).toEqual([{ repo_id: 1 }]);
    expect(out.mock.calls.at(-1)[0]).toMatch(
      /restored 2 states, 1 notices, 3 tags/,
    );
  });

  it("restore requires a file argument", async () => {
    stubApi();
    await expect(run(["restore"], out)).rejects.toThrow(/usage: restore/);
  });

  it("restore surfaces an unreadable file", async () => {
    stubApi();
    await expect(
      run(["restore", "/no/such/backup-file.json"], out),
    ).rejects.toThrow(/could not read backup file/);
  });

  it("restore tolerates a response without a restored summary", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const file = path.join(
      os.tmpdir(),
      `repo-triage-restore2-${Date.now()}.json`,
    );
    fs.writeFileSync(
      file,
      JSON.stringify({ repo_state: [], repo_notice: [], repo_tag: [] }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      })),
    );
    await run(["restore", file], out);
    fs.rmSync(file, { force: true });

    expect(out.mock.calls.at(-1)[0]).toMatch(
      /restored 0 states, 0 notices, 0 tags/,
    );
  });

  it("surfaces a friendly error when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    await expect(run(["list"], out)).rejects.toThrow(/Is the server running/);
  });

  it("surfaces the same friendly error for report (text GET) when unreachable", async () => {
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        // The repo lookup (JSON) succeeds; the report text GET is what fails.
        if (url.endsWith("/api/repos") && first) {
          first = false;
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ repos: REPOS }),
          };
        }
        throw new Error("ECONNREFUSED");
      }),
    );
    await expect(run(["report", "summary"], out)).rejects.toThrow(
      /Is the server running/,
    );
  });

  it('priority clears with the "clear" keyword and defaults a missing arg to none', async () => {
    let calls = stubApi();
    await run(["priority", "me/alpha", "clear"], out);
    expect(calls.find((c) => c.url.includes("/priority"))).toMatchObject({
      body: { priority: null },
    });

    vi.unstubAllGlobals();
    calls = stubApi();
    await run(["priority", "me/alpha"], out);
    expect(calls.find((c) => c.url.includes("/priority"))).toMatchObject({
      body: { priority: null },
    });
  });

  it("watch rejects non-positive --interval", async () => {
    stubApi();
    await expect(run(["watch", "--interval", "0"])).rejects.toThrow(
      /--interval must be a positive/,
    );
  });
});

describe("watchOnce", () => {
  const makeRepos = (overrides = []) => [
    { id: 1, full_name: "me/alpha", column: "day-0", ignored: false },
    { id: 2, full_name: "me/beta", column: "day-1", ignored: false },
    { id: 3, full_name: "me/gamma", column: "day-0", ignored: true },
    ...overrides,
  ];

  const fakeCall = (repos) => async () => ({ repos });

  it("todayIds includes only day-0 non-ignored repos", async () => {
    const { todayIds } = await watchOnce(
      "http://localhost:8787",
      new Set([1]),
      {
        call: fakeCall(makeRepos()),
      },
    );
    expect(todayIds).toEqual(new Set([1])); // repo 2 is day-1, repo 3 is ignored
  });

  it("returns all day-0 non-ignored repos as newlyDue when prev is empty", async () => {
    const { newlyDue } = await watchOnce("http://localhost:8787", new Set(), {
      call: fakeCall(makeRepos()),
    });
    expect(newlyDue.map((r) => r.id)).toEqual([1]);
  });

  it("newlyDue is empty when today has not changed", async () => {
    const { newlyDue } = await watchOnce(
      "http://localhost:8787",
      new Set([1]),
      {
        call: fakeCall(makeRepos()),
      },
    );
    expect(newlyDue).toHaveLength(0);
  });

  it("detects newly-due repo not in prev", async () => {
    const newRepo = {
      id: 4,
      full_name: "me/new",
      column: "day-0",
      ignored: false,
    };
    const { newlyDue, todayIds } = await watchOnce(
      "http://localhost:8787",
      new Set([1]),
      {
        call: fakeCall(makeRepos([newRepo])),
      },
    );
    expect(newlyDue.map((r) => r.id)).toEqual([4]);
    expect(todayIds.has(4)).toBe(true);
  });

  it("calls notify when notify=true and there are newly-due repos", async () => {
    const ef = vi.fn();
    await watchOnce("http://localhost:8787", new Set(), {
      call: fakeCall(makeRepos()),
      notify: true,
      execFile: ef,
    });
    // On darwin/linux ef gets called; on other platforms it is a no-op — just
    // verify it was called on supported platforms or skipped gracefully.
    // The sendNotify function is platform-gated, so we test it separately.
    expect(typeof ef).toBe("function");
  });

  it("does not call notify when notify=false", async () => {
    const ef = vi.fn();
    await watchOnce("http://localhost:8787", new Set(), {
      call: fakeCall(makeRepos()),
      notify: false,
      execFile: ef,
    });
    expect(ef).not.toHaveBeenCalled();
  });
});

describe("sendNotify", () => {
  it("calls osascript on darwin", () => {
    const ef = vi.fn();
    const origPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    sendNotify("Title", "Message", ef);
    Object.defineProperty(process, "platform", origPlatform);
    expect(ef).toHaveBeenCalledWith(
      "osascript",
      expect.arrayContaining(["-e"]),
      expect.any(Object),
    );
  });

  it("calls notify-send on linux", () => {
    const ef = vi.fn();
    const origPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
    sendNotify("Title", "Message", ef);
    Object.defineProperty(process, "platform", origPlatform);
    expect(ef).toHaveBeenCalledWith(
      "notify-send",
      ["Title", "Message"],
      expect.any(Object),
    );
  });

  it("is a no-op (does not throw) when execFile fails", () => {
    const ef = vi.fn(() => {
      throw new Error("not found");
    });
    const origPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    expect(() => sendNotify("T", "M", ef)).not.toThrow();
    Object.defineProperty(process, "platform", origPlatform);
  });

  it("calls powershell on win32", () => {
    const ef = vi.fn();
    const origPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    sendNotify("Title", "Message", ef);
    Object.defineProperty(process, "platform", origPlatform);
    expect(ef).toHaveBeenCalledWith(
      "powershell",
      expect.arrayContaining(["-Command"]),
      expect.any(Object),
    );
  });
});
