import { render, screen } from "@testing-library/react";
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

const basePayload = {
  repos: [
    {
      id: 1,
      name: "repo-with-icons",
      full_name: "user/repo-with-icons",
      html_url: "https://example.com/repo-with-icons",
      description: "icon test repo",
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
    },
  ],
  cacheReady: true,
  defaultInactivityDays: 7,
  lastFetch: "2026-06-03T00:00:00.000Z",
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe("App icon affordances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(
      "repo-triage-board-cache-v1",
      JSON.stringify({
        savedAt: "2026-06-03T00:00:00.000Z",
        payload: basePayload,
      }),
    );
    api.list.mockResolvedValue(basePayload);
  });

  it("renders lucide icons in primary controls with accessible labels", async () => {
    const { container } = render(<App />);

    expect(screen.getByLabelText("Search repositories")).toBeInTheDocument();

    const syncButton = screen.getByRole("button", { name: "sync GitHub" });
    expect(syncButton.querySelector("svg")).not.toBeNull();

    const settingsButton = screen.getByRole("button", {
      name: "Open repository settings",
    });
    expect(settingsButton.querySelector("svg")).not.toBeNull();

    const ownFilter = screen.getByText("own").closest("label");
    expect(ownFilter?.querySelector("svg")).not.toBeNull();

    expect(container.querySelectorAll("svg").length).toBeGreaterThan(3);
  });
});
