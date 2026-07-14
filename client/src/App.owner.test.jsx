import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App, { ownerColor } from "./App.jsx";
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

const card = (over) => ({
  id: 1,
  name: "r",
  full_name: "o/r",
  owner: "o",
  owner_type: "Organization",
  html_url: "https://x/r",
  description: "d",
  private: false,
  archived: false,
  fork: false,
  language: "JS",
  pushed_at: "2026-06-01T00:00:00.000Z",
  checkedAgeDays: 0,
  dueInDays: 7,
  needsCheckToday: false,
  column: "day-0",
  position: 0,
  ...over,
});

const basePayload = {
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

describe("ownerColor", () => {
  it("is deterministic and returns a palette hex", () => {
    const a = ownerColor("davidsneighbour");
    expect(a).toMatch(/^#[0-9a-f]{6}$/i);
    expect(ownerColor("davidsneighbour")).toBe(a);
  });

  it("tolerates empty input", () => {
    expect(ownerColor("")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("owner indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows an owner badge per card when the board mixes owners", async () => {
    api.list.mockResolvedValue({
      ...basePayload,
      owners: ["davidsneighbour", "dnbhq"],
      repos: [
        card({
          id: 1,
          name: "a",
          full_name: "davidsneighbour/a",
          owner: "davidsneighbour",
        }),
        card({ id: 2, name: "b", full_name: "dnbhq/b", owner: "dnbhq" }),
      ],
    });

    render(<App />);

    expect(
      await screen.findByTitle("owner: davidsneighbour"),
    ).toBeInTheDocument();
    expect(screen.getByTitle("owner: dnbhq")).toBeInTheDocument();
  });

  it("hides the owner badge for a single-owner board", async () => {
    api.list.mockResolvedValue({
      ...basePayload,
      owners: ["davidsneighbour"],
      repos: [
        card({
          id: 1,
          name: "a",
          full_name: "davidsneighbour/a",
          owner: "davidsneighbour",
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("link", { name: "a" });
    expect(
      screen.queryByTitle("owner: davidsneighbour"),
    ).not.toBeInTheDocument();
  });

  it("surfaces source-warnings in the status dialog", async () => {
    api.list.mockResolvedValue({
      ...basePayload,
      owners: ["gohugo-ananke"],
      repos: [
        card({ id: 1, full_name: "gohugo-ananke/x", owner: "gohugo-ananke" }),
      ],
      sourceWarnings: [
        'Token is not a member of organization "gohugo-ananke" — loaded its public repositories only.',
      ],
    });

    render(<App />);
    await screen.findByRole("link", { name: "r" });

    // Status button highlights when warnings are present.
    const statusBtn = screen.getByRole("button", {
      name: "Open dashboard status",
    });
    expect(statusBtn).toBeInTheDocument();

    // Warning is accessible via the status dialog.
    fireEvent.click(statusBtn);
    expect(
      await screen.findByText(/not a member of organization "gohugo-ananke"/),
    ).toBeInTheDocument();
  });
});
