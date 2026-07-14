import { fireEvent, render, screen } from "@testing-library/react";
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
  },
}));

const payload = {
  repos: [
    {
      id: 1,
      name: "alpha",
      full_name: "me/alpha",
      html_url: "https://x/alpha",
      description: "a description",
      private: false,
      archived: false,
      fork: false,
      language: "JS",
      pushed_at: "2026-06-01T00:00:00.000Z",
      checkedAgeDays: 3,
      dueInDays: 4,
      needsCheckToday: false,
      column: "day-0",
      position: 0,
      tags: ["mytag"],
      latest_notice: {
        body: "a pinned note",
        created_at: "2026-06-02T00:00:00.000Z",
      },
    },
  ],
  cacheReady: true,
  syncing: false,
  defaultInactivityDays: 7,
  lastFetch: "2026-06-03T00:00:00.000Z",
  owners: [],
  sourceWarnings: [],
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe("card density toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
  });

  it("hides the notice preview in compact mode and persists the choice", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    // comfortable (default): notice preview visible
    expect(screen.getByText("a pinned note")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "compact" }));

    expect(screen.queryByText("a pinned note")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("repo-triage-density")).toBe("compact");
  });

  it("restores compact density from localStorage on reload", async () => {
    window.localStorage.setItem("repo-triage-density", "compact");
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    expect(screen.queryByText("a pinned note")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "compact" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides the add-tag button, pushed date, review info, and checked text in compact mode", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    // Comfortable: all secondary elements visible.
    expect(
      screen.getByRole("button", { name: "Add tag to alpha" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pushed \d/)).toBeInTheDocument();
    expect(screen.getByText(/review in \d+d/)).toBeInTheDocument();
    expect(screen.getByText(/checked \d+d ago/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "compact" }));

    // Compact: secondary elements hidden; tag chips and name remain.
    expect(
      screen.queryByRole("button", { name: "Add tag to alpha" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/pushed \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/review in \d+d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/checked \d+d ago/)).not.toBeInTheDocument();
    // Tag chips still visible (read-only).
    expect(screen.getByText("#mytag")).toBeInTheDocument();
  });
});
