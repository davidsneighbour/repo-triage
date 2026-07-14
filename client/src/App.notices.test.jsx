import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { api } from "./api.js";

vi.mock("./api.js", () => ({
  api: {
    list: vi.fn(),
    getTags: vi.fn(),
    refresh: vi.fn(),
    setPriority: vi.fn(),
    setChecked: vi.fn(),
    touch: vi.fn(),
    setInactivity: vi.fn(),
    reorder: vi.fn(),
    setIgnored: vi.fn(),
    addNotice: vi.fn(),
    repoNotices: vi.fn(),
    allNotices: vi.fn(),
    deleteNotice: vi.fn(),
    getActivity: vi.fn(),
  },
}));

const repoA = {
  id: 1,
  name: "repo-a",
  full_name: "user/repo-a",
  html_url: "https://example.com/repo-a",
  description: "visible repo",
  private: false,
  archived: false,
  fork: false,
  language: "JavaScript",
  pushed_at: "2026-06-01T00:00:00.000Z",
  checkedAgeDays: 0,
  dueInDays: 7,
  needsCheckToday: false,
  column: "day-0",
  position: 0,
  inactivity_days: null,
  ignored: false,
  notice_count: 2,
  latest_notice: {
    body: "card preview note",
    created_at: "2026-06-02T00:00:00.000Z",
  },
};

const repoB = {
  ...repoA,
  id: 2,
  name: "repo-b",
  full_name: "user/repo-b",
  description: "ignored repo",
  ignored: true,
  notice_count: 0,
  latest_notice: null,
};

const payload = {
  repos: [repoA, repoB],
  cacheReady: true,
  defaultInactivityDays: 7,
  lastFetch: "2026-06-03T00:00:00.000Z",
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe("ignore flag + notices UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.setIgnored.mockResolvedValue({ ok: true });
    api.addNotice.mockResolvedValue({ ok: true, id: 9 });
    api.deleteNotice.mockResolvedValue({ ok: true });
    api.repoNotices.mockResolvedValue({ notices: [] });
    api.getActivity.mockResolvedValue({ activity: [] });
    api.allNotices.mockResolvedValue({
      notices: [
        {
          id: 11,
          repo_id: 1,
          full_name: "user/repo-a",
          body: "alpha note",
          created_at: "2026-06-01T00:00:00.000Z",
        },
        {
          id: 12,
          repo_id: 2,
          full_name: "user/repo-b",
          body: "beta note",
          created_at: "2026-06-02T00:00:00.000Z",
        },
      ],
    });
  });

  it("hides ignored repos until the show-ignored toggle is on", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "repo-a" });

    expect(
      screen.queryByRole("link", { name: "repo-b" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show ignored/i }));

    expect(
      await screen.findByRole("link", { name: "repo-b" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ignored")).toBeInTheDocument();
    expect(window.localStorage.getItem("repo-triage-show-ignored")).toBe(
      "true",
    );
  });

  it("renders the latest notice preview on the card", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "repo-a" });
    expect(screen.getByText("card preview note")).toBeInTheDocument();
  });

  it("wires the card menu ignore + add-notice actions to the API", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "repo-a" });

    fireEvent.click(
      screen.getByRole("button", { name: "Open repository settings" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "New notice" }), {
      target: { value: "a fresh note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(api.addNotice).toHaveBeenCalledWith(1, "a fresh note"),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open repository settings" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ignore repo" }));
    await waitFor(() => expect(api.setIgnored).toHaveBeenCalledWith(1, true));
  });

  it("opens the all-repos notices dialog, sorts, and deletes", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "repo-a" });

    fireEvent.click(screen.getByRole("button", { name: /notices/i }));

    expect(await screen.findByText("alpha note")).toBeInTheDocument();
    expect(screen.getByText("beta note")).toBeInTheDocument();

    // Sort by repo name, then flip direction — pure client-side transforms.
    fireEvent.click(screen.getByRole("button", { name: "repo" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle sort direction" }),
    );

    // Deleting is a two-step confirm: arm, then confirm.
    const deleteButtons = screen.getAllByRole("button", {
      name: "Delete notice",
    });
    fireEvent.click(deleteButtons[0]);
    expect(api.deleteNotice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.deleteNotice).toHaveBeenCalled());
  });

  it("cancels an armed notice delete without calling the API", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "repo-a" });

    fireEvent.click(screen.getByRole("button", { name: /notices/i }));
    await screen.findByText("alpha note");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete notice" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

    expect(api.deleteNotice).not.toHaveBeenCalled();
    // Back to the armed-off state: the trash button is shown again.
    expect(
      screen.getAllByRole("button", { name: "Delete notice" }).length,
    ).toBeGreaterThan(0);
  });

  it("opens the notices dialog scoped to a single repo from the card menu", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "repo-a" });

    fireEvent.click(
      screen.getByRole("button", { name: "Open repository settings" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /View all/ }));

    await waitFor(() => expect(api.repoNotices).toHaveBeenCalledWith(1));
    const dialog = await screen.findByText("show all repos");
    expect(dialog).toBeInTheDocument();
  });
});
