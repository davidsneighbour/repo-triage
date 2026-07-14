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
  repos: [],
  cacheReady: true,
  defaultInactivityDays: 7,
  lastFetch: "2026-06-03T00:00:00.000Z",
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

describe("App error and rate-limit banners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders auth invalid banner and disables sync button", async () => {
    api.list.mockResolvedValue({
      ...basePayload,
      rateLimit: { ...basePayload.rateLimit, authInvalid: true },
    });

    render(<App />);

    expect(
      await screen.findByText("GitHub token is invalid or expired."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sync GitHub" })).toBeDisabled();
  });

  it("renders rate-limit exhausted banner and disables sync button", async () => {
    api.list.mockResolvedValue({
      ...basePayload,
      rateLimit: { ...basePayload.rateLimit, remaining: 0, reset: 1700000000 },
    });

    render(<App />);

    expect(
      await screen.findByText(/GitHub API rate limit exhausted/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sync GitHub" })).toBeDisabled();
  });

  it("renders generic GitHub error banner when not auth/rate-limit failure", async () => {
    api.list.mockResolvedValue({
      ...basePayload,
      lastError: "upstream timeout",
    });

    render(<App />);

    expect(
      await screen.findByText(/GitHub error: upstream timeout/),
    ).toBeInTheDocument();
  });
});
