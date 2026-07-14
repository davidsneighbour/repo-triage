import { describe, expect, it } from "vitest";
import {
  buildDayColumns,
  collectTags,
  defaultFilters,
  filterRepos,
  groupRepos,
  groupReposBy,
  matchesPriorityFilter,
  matchesTagFilter,
  repoMatchesQuery,
  sortColumnRepos,
  sortNotices,
  sortReposForList,
} from "./board.js";

const repos = [
  {
    id: 1,
    name: "own-live",
    description: "alpha",
    language: "JS",
    fork: false,
    archived: false,
    column: "day-0",
    position: 2,
  },
  {
    id: 2,
    name: "fork-live",
    description: "beta",
    language: "TS",
    fork: true,
    archived: false,
    column: "day-1",
    position: 1,
  },
  {
    id: 3,
    name: "own-archived",
    description: "gamma",
    language: "Go",
    fork: false,
    archived: true,
    column: "day-2",
    position: 0,
  },
];

describe("filterRepos", () => {
  it("includes all repos with default filters", () => {
    expect(filterRepos(repos, "", defaultFilters)).toHaveLength(3);
  });

  it("applies inclusive union visibility filters", () => {
    const filtered = filterRepos(repos, "", {
      showOwn: true,
      showForks: false,
      showArchived: false,
    });
    expect(filtered.map((repo) => repo.id)).toEqual([1]);
  });

  it("matches search term against name/description/language", () => {
    expect(
      filterRepos(repos, "go", defaultFilters).map((repo) => repo.id),
    ).toEqual([3]);
  });

  it("hides ignored repos by default and shows them when showIgnored is on", () => {
    const withIgnored = [
      ...repos,
      { id: 9, name: "hidden", fork: false, archived: false, ignored: true },
    ];
    expect(
      filterRepos(withIgnored, "", defaultFilters).map((r) => r.id),
    ).not.toContain(9);
    expect(
      filterRepos(withIgnored, "", defaultFilters, true).map((r) => r.id),
    ).toContain(9);
  });

  it("narrows by the tag filter (any / all)", () => {
    const tagged = [
      { id: 10, name: "t1", fork: false, archived: false, tags: ["infra"] },
      {
        id: 11,
        name: "t2",
        fork: false,
        archived: false,
        tags: ["oss", "infra"],
      },
    ];
    expect(
      filterRepos(tagged, "", defaultFilters, false, {
        tags: ["oss"],
        mode: "any",
      }).map((r) => r.id),
    ).toEqual([11]);
    expect(
      filterRepos(tagged, "", defaultFilters, false, {
        tags: ["oss", "infra"],
        mode: "all",
      }).map((r) => r.id),
    ).toEqual([11]);
    expect(
      filterRepos(tagged, "", defaultFilters, false, {
        tags: ["oss", "infra"],
        mode: "any",
      }).map((r) => r.id),
    ).toEqual([10, 11]);
  });

  it("narrows by the priority filter, independent of other axes", () => {
    const pri = [
      { id: 20, name: "p1", fork: false, archived: false, priority: 1 },
      { id: 21, name: "p2", fork: false, archived: false, priority: 2 },
      { id: 22, name: "none", fork: false, archived: false, priority: null },
    ];
    expect(
      filterRepos(pri, "", defaultFilters, false, null, [1, 2]).map(
        (r) => r.id,
      ),
    ).toEqual([20, 21]);
    expect(
      filterRepos(pri, "", defaultFilters, false, null, [0]).map((r) => r.id),
    ).toEqual([22]);
    expect(
      filterRepos(pri, "", defaultFilters, false, null, []).map((r) => r.id),
    ).toEqual([20, 21, 22]);
  });
});

describe("matchesPriorityFilter", () => {
  it("passes when nothing is selected", () => {
    expect(matchesPriorityFilter({ priority: 1 }, [])).toBe(true);
    expect(matchesPriorityFilter({ priority: null }, null)).toBe(true);
  });

  it('treats a null priority as level 0 ("none")', () => {
    expect(matchesPriorityFilter({ priority: null }, [0])).toBe(true);
    expect(matchesPriorityFilter({ priority: 2 }, [0])).toBe(false);
  });

  it("matches the selected levels", () => {
    expect(matchesPriorityFilter({ priority: 2 }, [1, 2])).toBe(true);
    expect(matchesPriorityFilter({ priority: 3 }, [1, 2])).toBe(false);
  });
});

describe("matchesTagFilter", () => {
  const repo = { tags: ["infra", "oss"] };

  it("passes when no tags are selected", () => {
    expect(matchesTagFilter(repo, [])).toBe(true);
    expect(matchesTagFilter(repo, undefined)).toBe(true);
  });

  it("any mode matches when at least one selected tag is present", () => {
    expect(matchesTagFilter(repo, ["oss", "x"], "any")).toBe(true);
    expect(matchesTagFilter(repo, ["x"], "any")).toBe(false);
  });

  it("all mode matches only when every selected tag is present", () => {
    expect(matchesTagFilter(repo, ["infra", "oss"], "all")).toBe(true);
    expect(matchesTagFilter(repo, ["infra", "x"], "all")).toBe(false);
  });

  it("tolerates repos with no tags", () => {
    expect(matchesTagFilter({}, ["x"], "any")).toBe(false);
  });
});

describe("collectTags", () => {
  it("counts distinct tags, sorted by count then name", () => {
    const repos2 = [{ tags: ["a", "b"] }, { tags: ["a"] }, { tags: [] }, {}];
    expect(collectTags(repos2)).toEqual([
      { tag: "a", count: 2 },
      { tag: "b", count: 1 },
    ]);
  });
});

describe("sortReposForList", () => {
  const repos = [
    {
      id: 1,
      name: "banana",
      owner: "me",
      priority: 2,
      language: "Go",
      pushed_at: "2026-01-01T00:00:00.000Z",
      stargazers_count: 5,
      open_issues_count: 1,
      forks_count: 2,
      dueInDays: 3,
      checkedAgeDays: 2,
    },
    {
      id: 2,
      name: "apple",
      owner: "dnbhq",
      priority: 1,
      language: "JS",
      pushed_at: "2026-06-01T00:00:00.000Z",
      stargazers_count: 9,
      open_issues_count: 4,
      forks_count: 8,
      dueInDays: 1,
      checkedAgeDays: null,
    },
    {
      id: 3,
      name: "cherry",
      owner: "me",
      priority: null,
      language: "Go",
      pushed_at: "2026-03-01T00:00:00.000Z",
      stargazers_count: 1,
      open_issues_count: 0,
      forks_count: 5,
      dueInDays: 7,
      checkedAgeDays: 0,
    },
  ];
  const ids = (col, dir) => sortReposForList(repos, col, dir).map((r) => r.id);

  it("sorts by name ascending by default", () => {
    expect(ids("repo")).toEqual([2, 1, 3]); // apple, banana, cherry
  });

  it("sorts by priority (P1 first), with unset last", () => {
    expect(ids("priority", "asc")).toEqual([2, 1, 3]);
  });

  it("sorts numeric/recency columns descending", () => {
    expect(ids("stars", "desc")).toEqual([2, 1, 3]);
    expect(ids("pushed", "desc")).toEqual([2, 3, 1]);
    expect(ids("forks", "desc")).toEqual([2, 3, 1]); // 8, 5, 2
  });

  it("sorts due ascending and treats a missing checked age as oldest-last", () => {
    expect(ids("due", "asc")).toEqual([2, 1, 3]);
    expect(ids("checked", "asc")).toEqual([3, 1, 2]); // 0, 2, then null(Infinity)
  });

  it("does not mutate the input", () => {
    const before = repos.map((r) => r.id);
    sortReposForList(repos, "stars", "desc");
    expect(repos.map((r) => r.id)).toEqual(before);
  });

  it("tolerates sparse repos (missing fields) across every column", () => {
    const sparse = [
      { id: 9 },
      {
        id: 8,
        name: "z",
        owner: "z",
        priority: 1,
        language: "Z",
        pushed_at: "2026-01-01T00:00:00.000Z",
        stargazers_count: 1,
        open_issues_count: 1,
        dueInDays: 1,
        checkedAgeDays: 1,
      },
    ];
    for (const col of [
      "repo",
      "owner",
      "priority",
      "language",
      "pushed",
      "stars",
      "issues",
      "due",
      "checked",
    ]) {
      expect(() => sortReposForList(sparse, col, "asc")).not.toThrow();
      expect(() => sortReposForList(sparse, col, "desc")).not.toThrow();
    }
    // Unknown column falls back to the repo-name sorter.
    expect(sortReposForList(sparse, "bogus").map((r) => r.id)).toEqual([9, 8]);
  });
});

describe("sortColumnRepos", () => {
  const repos = [
    { id: 1, name: "banana", owner: "me", stargazers_count: 5 },
    { id: 2, name: "apple", owner: "zeta", stargazers_count: 9 },
    { id: 3, name: "cherry", owner: "amy", stargazers_count: 1 },
  ];
  const ids = (key, dir) => sortColumnRepos(repos, key, dir).map((r) => r.id);

  it("returns the input untouched for an unknown/empty key", () => {
    expect(sortColumnRepos(repos, null)).toBe(repos);
    expect(sortColumnRepos(repos, "bogus")).toBe(repos);
  });

  it("sorts by name, stars and owner in both directions", () => {
    expect(ids("name", "asc")).toEqual([2, 1, 3]); // apple, banana, cherry
    expect(ids("name", "desc")).toEqual([3, 1, 2]);
    expect(ids("stars", "asc")).toEqual([3, 1, 2]); // 1, 5, 9
    expect(ids("stars", "desc")).toEqual([2, 1, 3]);
    expect(ids("owner", "asc")).toEqual([3, 1, 2]); // amy, me, zeta
    expect(ids("owner", "desc")).toEqual([2, 1, 3]);
  });

  it("does not mutate the input", () => {
    const before = repos.map((r) => r.id);
    sortColumnRepos(repos, "stars", "desc");
    expect(repos.map((r) => r.id)).toEqual(before);
  });

  it("uses name as tiebreaker when primary sort values are equal", () => {
    const tied = [
      { id: 1, name: "zebra", stargazers_count: 5 },
      { id: 2, name: "apple", stargazers_count: 5 },
    ];
    expect(sortColumnRepos(tied, "stars").map((r) => r.id)).toEqual([2, 1]);
  });

  it("handles repos with missing name / owner / stargazers (|| fallbacks)", () => {
    const sparse = [
      { id: 1, name: null, owner: null, stargazers_count: null },
      { id: 2, name: "z", owner: "z", stargazers_count: 1 },
    ];
    expect(() => sortColumnRepos(sparse, "name")).not.toThrow();
    expect(() => sortColumnRepos(sparse, "owner")).not.toThrow();
    expect(() => sortColumnRepos(sparse, "stars")).not.toThrow();
  });
});

describe("sortNotices", () => {
  const notices = [
    { id: 1, full_name: "b/repo", created_at: "2026-06-01T00:00:00.000Z" },
    { id: 2, full_name: "a/repo", created_at: "2026-06-03T00:00:00.000Z" },
    { id: 3, full_name: "c/repo", created_at: "2026-06-02T00:00:00.000Z" },
  ];

  it("sorts by date descending by default", () => {
    expect(sortNotices(notices).map((n) => n.id)).toEqual([2, 3, 1]);
  });

  it("sorts by date ascending", () => {
    expect(sortNotices(notices, "date", "asc").map((n) => n.id)).toEqual([
      1, 3, 2,
    ]);
  });

  it("sorts by repo name", () => {
    expect(sortNotices(notices, "repo", "asc").map((n) => n.full_name)).toEqual(
      ["a/repo", "b/repo", "c/repo"],
    );
  });

  it("does not mutate the input array", () => {
    const input = [...notices];
    sortNotices(input, "repo", "desc");
    expect(input.map((n) => n.id)).toEqual([1, 2, 3]);
  });
});

describe("repoMatchesQuery", () => {
  const repo = repos[2]; // own-archived / gamma / Go

  it("matches everything for an empty or whitespace query", () => {
    expect(repoMatchesQuery(repo, "")).toBe(true);
    expect(repoMatchesQuery(repo, "   ")).toBe(true);
    expect(repoMatchesQuery(repo, undefined)).toBe(true);
  });

  it("matches name, description, and language case-insensitively", () => {
    expect(repoMatchesQuery(repo, "OWN")).toBe(true);
    expect(repoMatchesQuery(repo, "gamma")).toBe(true);
    expect(repoMatchesQuery(repo, "go")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(repoMatchesQuery(repo, "zzz")).toBe(false);
  });

  it("tolerates a missing description or language", () => {
    expect(repoMatchesQuery({ name: "solo" }, "solo")).toBe(true);
    expect(repoMatchesQuery({ name: "solo" }, "js")).toBe(false);
  });
});

describe("buildDayColumns", () => {
  it("builds expected day columns from inactivity days", () => {
    const columns = buildDayColumns(4, (offset) => ({
      title: `d${offset}`,
      subtitle: `s${offset}`,
    }));
    expect(columns.map((column) => column.key)).toEqual([
      "day-0",
      "day-1",
      "day-2",
      "day-3",
    ]);
    expect(columns[0].accent).toBe("rose");
    expect(columns[1].accent).toBe("amber");
    expect(columns[3].accent).toBe("sky");
    expect(columns[0].daysAgoTarget).toBe(4);
    expect(columns[3].daysAgoTarget).toBe(1);
  });
});

describe("groupRepos", () => {
  it("groups by column and sorts by position then name", () => {
    const columns = [{ key: "day-0" }, { key: "day-1" }, { key: "day-2" }];
    const grouped = groupRepos(
      [
        repos[0],
        { ...repos[0], id: 4, name: "aaa", column: "day-0", position: 2 },
        repos[1],
        repos[2],
      ],
      columns,
    );

    expect(grouped["day-0"].map((repo) => repo.id)).toEqual([4, 1]);
    expect(grouped["day-1"].map((repo) => repo.id)).toEqual([2]);
    expect(grouped["day-2"].map((repo) => repo.id)).toEqual([3]);
  });

  it("applies the chosen within-column sort order", () => {
    const columns = [{ key: "day-0" }];
    const inCol = [
      {
        id: 1,
        name: "banana",
        column: "day-0",
        position: 0,
        pushed_at: "2026-01-01T00:00:00.000Z",
        stargazers_count: 5,
        dueInDays: 3,
      },
      {
        id: 2,
        name: "apple",
        column: "day-0",
        position: 1,
        pushed_at: "2026-06-01T00:00:00.000Z",
        stargazers_count: 1,
        dueInDays: 1,
      },
      {
        id: 3,
        name: "cherry",
        column: "day-0",
        position: 2,
        pushed_at: "2026-03-01T00:00:00.000Z",
        stargazers_count: 9,
        dueInDays: 7,
      },
    ];
    const ids = (key) =>
      groupRepos(inCol, columns, key)["day-0"].map((r) => r.id);

    expect(ids("manual")).toEqual([1, 2, 3]); // by position
    expect(ids("name")).toEqual([2, 1, 3]); // apple, banana, cherry
    expect(ids("pushed")).toEqual([2, 3, 1]); // most recent first
    expect(ids("stars")).toEqual([3, 1, 2]); // most stars first
    expect(ids("due")).toEqual([2, 1, 3]); // soonest due first
  });

  it("falls back to manual order for an unknown sort key", () => {
    const columns = [{ key: "day-0" }];
    const inCol = [
      { id: 1, name: "b", column: "day-0", position: 1 },
      { id: 2, name: "a", column: "day-0", position: 0 },
    ];
    expect(
      groupRepos(inCol, columns, "bogus")["day-0"].map((r) => r.id),
    ).toEqual([2, 1]);
  });

  it("places a repo in day-0 when its column is not in the day grid", () => {
    const columns = [{ key: "day-0" }, { key: "day-1" }];
    const repos = [
      { id: 1, name: "a", column: "day-99", position: 0 },
      { id: 2, name: "b", column: "day-0", position: 1 },
    ];
    const grouped = groupRepos(repos, columns);
    expect(grouped["day-0"].map((r) => r.id)).toContain(1);
    expect(grouped["day-99"]).toBeUndefined();
  });

  it("excludes unchecked repos from all day buckets", () => {
    const columns = [{ key: "day-0" }, { key: "day-1" }];
    const repos = [
      { id: 1, name: "a", column: "unchecked", position: 0 },
      { id: 2, name: "b", column: "day-0", position: 1 },
    ];
    const grouped = groupRepos(repos, columns);
    expect(grouped["day-0"].map((r) => r.id)).toEqual([2]);
    expect(
      Object.values(grouped)
        .flat()
        .map((r) => r.id),
    ).not.toContain(1);
  });
});

describe("groupReposBy", () => {
  const sample = [
    {
      id: 1,
      name: "a",
      owner: "me",
      language: "JS",
      tags: ["infra"],
      position: 0,
    },
    {
      id: 2,
      name: "b",
      owner: "me",
      language: "Go",
      tags: ["infra", "oss"],
      position: 1,
    },
    { id: 3, name: "c", owner: "dnbhq", language: null, tags: [], position: 2 },
  ];

  it('groups by owner with a "no owner" bucket pinned last', () => {
    const cols = groupReposBy(
      [...sample, { id: 4, name: "d", owner: null, tags: [] }],
      "owner",
    );
    expect(cols.map((c) => c.title)).toEqual(["me", "dnbhq", "no owner"]);
    expect(cols[0].repos.map((r) => r.id)).toEqual([1, 2]);
    expect(cols.every((c) => c.schedulable === false)).toBe(true);
  });

  it("fans repos out across every tag, with an untagged bucket last", () => {
    const cols = groupReposBy(sample, "tag");
    const byTitle = Object.fromEntries(
      cols.map((c) => [c.title, c.repos.map((r) => r.id)]),
    );
    expect(byTitle["#infra"]).toEqual([1, 2]);
    expect(byTitle["#oss"]).toEqual([2]);
    expect(byTitle.untagged).toEqual([3]);
    expect(cols[cols.length - 1].title).toBe("untagged");
  });

  it('groups by language with a "no language" fallback', () => {
    const cols = groupReposBy(sample, "language");
    expect(cols.map((c) => c.title)).toContain("no language");
    const subtitle = cols.find((c) => c.title === "JS").subtitle;
    expect(subtitle).toBe("1 repo");
  });
});
