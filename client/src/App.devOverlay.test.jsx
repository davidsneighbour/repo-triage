import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  repos: [],
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

describe("DevIdOverlay — dev-only rendering", () => {
  const originalDev = import.meta.env.DEV;
  const originalDevIdOverlay = import.meta.env.VITE_DEV_ID_OVERLAY;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
  });

  afterEach(() => {
    import.meta.env.DEV = originalDev;
    import.meta.env.VITE_DEV_ID_OVERLAY = originalDevIdOverlay;
  });

  it("renders the overlay toggle in dev mode", async () => {
    import.meta.env.DEV = true;
    render(<App />);
    expect(
      await screen.findByRole("button", {
        name: "Toggle element identifier overlay",
      }),
    ).toBeInTheDocument();
  });

  it("does not render the overlay toggle when DEV is false", async () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_DEV_ID_OVERLAY = "false";
    render(<App />);
    await screen.findByText(/loading|repositories/i).catch(() => {
      /* no-op */
    });
    expect(
      screen.queryByRole("button", {
        name: "Toggle element identifier overlay",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders the overlay toggle when the local Docker build flag is enabled", async () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_DEV_ID_OVERLAY = "true";
    render(<App />);
    expect(
      await screen.findByRole("button", {
        name: "Toggle element identifier overlay",
      }),
    ).toBeInTheDocument();
  });
});
