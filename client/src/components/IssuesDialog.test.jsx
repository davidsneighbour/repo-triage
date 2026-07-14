import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";
import { IssuesDialog } from "./IssuesDialog.jsx";

vi.mock("../api.js", () => ({
  api: {
    repoIssues: vi.fn(),
    syncRepoIssues: vi.fn(),
    setIssueSync: vi.fn(),
    setIssueFlagged: vi.fn(),
  },
}));

const repo = { id: 1, name: "alpha", full_name: "me/alpha" };
const noop = () => {
  /* no-op */
};

const issue = (over = {}) => ({
  number: 1,
  title: "a bug",
  state: "open",
  labels: ["bug"],
  body: "the details",
  html_url: "https://github.com/me/alpha/issues/1",
  github_updated_at: "2026-07-01T00:00:00Z",
  flagged: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.setIssueSync.mockResolvedValue({ ok: true, syncEnabled: true });
  api.setIssueFlagged.mockResolvedValue({ ok: true, flagged: true });
});

describe("IssuesDialog — load and on-demand sync", () => {
  it("loads stored issues, then triggers an on-demand sync", async () => {
    api.repoIssues.mockResolvedValue({ issues: [issue()], syncEnabled: true });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 1 });

    render(<IssuesDialog repo={repo} onClose={noop} />);

    expect(await screen.findByText(/a bug/)).toBeInTheDocument();
    await waitFor(() => expect(api.syncRepoIssues).toHaveBeenCalledWith(1));
  });

  it("shows an error message when on-demand sync fails", async () => {
    api.repoIssues.mockResolvedValue({ issues: [], syncEnabled: true });
    api.syncRepoIssues.mockRejectedValue(new Error("boom"));

    render(<IssuesDialog repo={repo} onClose={noop} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/sync failed/);
  });

  it("shows the server error message when sync responds with an error field", async () => {
    api.repoIssues.mockResolvedValue({ issues: [], syncEnabled: true });
    api.syncRepoIssues.mockResolvedValue({
      error: "GitHub API 404: Not Found",
    });

    render(<IssuesDialog repo={repo} onClose={noop} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GitHub API 404: Not Found",
    );
  });

  it("shows the empty state when there are no matching issues", async () => {
    api.repoIssues.mockResolvedValue({ issues: [], syncEnabled: true });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 0 });

    render(<IssuesDialog repo={repo} onClose={noop} />);

    expect(await screen.findByText("no matching issues")).toBeInTheDocument();
  });
});

describe("IssuesDialog — search, tag filter, state filter, sort", () => {
  const issues = [
    issue({
      number: 1,
      title: "fix login crash",
      state: "open",
      labels: ["bug"],
    }),
    issue({ number: 2, title: "update docs", state: "open", labels: ["docs"] }),
    issue({
      number: 3,
      title: "old crash report",
      state: "closed",
      labels: ["bug"],
    }),
  ];

  beforeEach(() => {
    api.repoIssues.mockResolvedValue({ issues, syncEnabled: true });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: issues.length });
  });

  it("defaults to showing only open issues", async () => {
    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/fix login crash/);
    expect(screen.queryByText(/old crash report/)).not.toBeInTheDocument();
  });

  it('the "all" state filter reveals closed issues too', async () => {
    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/fix login crash/);
    fireEvent.click(screen.getByRole("button", { name: "all" }));
    expect(await screen.findByText(/old crash report/)).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/fix login crash/);
    fireEvent.change(screen.getByRole("textbox", { name: "Search issues" }), {
      target: { value: "docs" },
    });
    expect(screen.queryByText(/fix login crash/)).not.toBeInTheDocument();
    expect(screen.getByText(/update docs/)).toBeInTheDocument();
  });

  it("filters by tag chip", async () => {
    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/fix login crash/);
    fireEvent.click(screen.getByRole("button", { name: "all" })); // include closed too
    fireEvent.click(screen.getByRole("button", { name: "docs" }));
    expect(screen.queryByText(/fix login crash/)).not.toBeInTheDocument();
    expect(screen.getByText(/update docs/)).toBeInTheDocument();
  });

  it("sort direction toggle reverses order", async () => {
    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/fix login crash/);
    const toggleBtn = screen.getByRole("button", {
      name: "Toggle sort direction",
    });
    expect(toggleBtn).toHaveTextContent("↓ desc");
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent("↑ asc");
  });
});

describe("IssuesDialog — row expansion", () => {
  it("expands a row on click to show the full body and collapses on a second click", async () => {
    api.repoIssues.mockResolvedValue({
      issues: [issue({ body: "the full description" })],
      syncEnabled: true,
    });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 1 });

    render(<IssuesDialog repo={repo} onClose={noop} />);
    const row = await screen.findByRole("button", { name: /a bug/ });

    expect(screen.queryByText("the full description")).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(await screen.findByText("the full description")).toBeInTheDocument();
    fireEvent.click(row);
    expect(screen.queryByText("the full description")).not.toBeInTheDocument();
  });
});

describe("IssuesDialog — sync toggle", () => {
  it("toggles auto-sync off and on", async () => {
    api.repoIssues.mockResolvedValue({ issues: [], syncEnabled: true });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 0 });

    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText("no matching issues");

    const toggle = screen.getByRole("button", { name: /auto-sync on/ });
    fireEvent.click(toggle);
    expect(api.setIssueSync).toHaveBeenCalledWith(1, false);
    expect(
      await screen.findByRole("button", { name: /auto-sync off/ }),
    ).toBeInTheDocument();
  });
});

describe("IssuesDialog — manual sync button", () => {
  it("re-syncs on click and reloads issues", async () => {
    api.repoIssues.mockResolvedValueOnce({ issues: [], syncEnabled: true });
    api.syncRepoIssues.mockResolvedValueOnce({ ok: true, count: 0 });

    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText("no matching issues");

    api.repoIssues.mockResolvedValueOnce({
      issues: [issue()],
      syncEnabled: true,
    });
    api.syncRepoIssues.mockResolvedValueOnce({ ok: true, count: 1 });

    fireEvent.click(screen.getByRole("button", { name: /sync now/ }));
    expect(await screen.findByText(/a bug/)).toBeInTheDocument();
  });
});

describe("IssuesDialog — flagging issues", () => {
  it("flags an issue and calls the API with the repo id and issue number", async () => {
    api.repoIssues.mockResolvedValue({
      issues: [issue({ number: 3, flagged: false })],
      syncEnabled: true,
    });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 1 });

    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/a bug/);

    fireEvent.click(screen.getByRole("button", { name: "Flag issue #3" }));
    expect(api.setIssueFlagged).toHaveBeenCalledWith(1, 3, true);
    expect(
      await screen.findByRole("button", { name: "Unflag issue #3" }),
    ).toBeInTheDocument();
  });

  it("rolls back the optimistic update when the API call fails", async () => {
    api.repoIssues.mockResolvedValue({
      issues: [issue({ number: 4, flagged: false })],
      syncEnabled: true,
    });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 1 });
    api.setIssueFlagged.mockRejectedValue(new Error("boom"));

    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/a bug/);

    fireEvent.click(screen.getByRole("button", { name: "Flag issue #4" }));
    expect(
      await screen.findByRole("button", { name: "Flag issue #4" }),
    ).toBeInTheDocument();
  });

  it("does not expand the row when the flag button is clicked", async () => {
    api.repoIssues.mockResolvedValue({
      issues: [issue({ number: 5 })],
      syncEnabled: true,
    });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 1 });

    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/a bug/);

    fireEvent.click(screen.getByRole("button", { name: "Flag issue #5" }));
    expect(screen.queryByText("the details")).not.toBeInTheDocument();
  });

  it('the "flagged" filter pill shows only flagged issues', async () => {
    api.repoIssues.mockResolvedValue({
      issues: [
        issue({ number: 1, title: "unflagged issue", flagged: false }),
        issue({ number: 2, title: "flagged issue", flagged: true }),
      ],
      syncEnabled: true,
    });
    api.syncRepoIssues.mockResolvedValue({ ok: true, count: 2 });

    render(<IssuesDialog repo={repo} onClose={noop} />);
    await screen.findByText(/unflagged issue/);

    fireEvent.click(screen.getByRole("button", { name: "flagged" }));
    expect(screen.queryByText(/unflagged issue/)).not.toBeInTheDocument();
    expect(screen.getByText(/flagged issue/)).toBeInTheDocument();
  });
});
