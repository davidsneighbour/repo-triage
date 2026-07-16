import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    clearSchedule: vi.fn(),
    restoreState: vi.fn(),
    setInactivity: vi.fn(),
    reorder: vi.fn(),
  },
}));

const payload = {
  repos: [
    {
      id: 1,
      name: "drag-source",
      full_name: "user/drag-source",
      html_url: "https://example.com/drag-source",
      description: "drag source",
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
    {
      id: 2,
      name: "drag-target",
      full_name: "user/drag-target",
      html_url: "https://example.com/drag-target",
      description: "drag target",
      private: false,
      archived: false,
      fork: false,
      language: "TypeScript",
      pushed_at: "2026-06-01T00:00:00.000Z",
      checkedAgeDays: 0,
      dueInDays: 7,
      needsCheckToday: false,
      column: "day-0",
      position: 1,
    },
    {
      id: 3,
      name: "never-reviewed",
      full_name: "user/never-reviewed",
      html_url: "https://example.com/never-reviewed",
      description: "never checked",
      private: false,
      archived: false,
      fork: false,
      language: "JavaScript",
      pushed_at: "2026-06-01T00:00:00.000Z",
      checkedAgeDays: null,
      dueInDays: 0,
      needsCheckToday: true,
      column: "unchecked",
      position: 2,
    },
  ],
  cacheReady: true,
  defaultInactivityDays: 2,
  lastFetch: "2026-06-03T00:00:00.000Z",
  tokenPresent: true,
  lastError: null,
  rateLimit: { remaining: 1000, limit: 5000, used: 4000, authInvalid: false },
};

function createDataTransfer(id) {
  return {
    getData: vi.fn().mockReturnValue(String(id)),
    setData: vi.fn(),
    effectAllowed: "move",
  };
}

describe("App drag and drop handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(
      "repo-triage-board-cache-v1",
      JSON.stringify({ savedAt: "2026-06-03T00:00:00.000Z", payload }),
    );
    api.list.mockResolvedValue(payload);
    api.setChecked.mockResolvedValue({ ok: true });
    api.clearSchedule.mockResolvedValue({ ok: true });
  });

  it("calls setChecked when dropping a card on another card", async () => {
    render(<App />);

    const targetLink = screen.getByRole("link", { name: "drag-target" });
    const targetCard = targetLink.closest('[draggable="true"]');

    fireEvent.drop(targetCard, {
      dataTransfer: createDataTransfer(1),
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });

    await waitFor(() => {
      expect(api.setChecked).toHaveBeenCalledWith(1, 2);
    });
  });

  it("calls setChecked when dropping a card on an empty column", async () => {
    render(<App />);

    const placeholders = screen.getAllByText("drag here");
    fireEvent.drop(placeholders[0], {
      dataTransfer: createDataTransfer(1),
      preventDefault: vi.fn(),
    });

    await waitFor(() => {
      expect(api.setChecked).toHaveBeenCalledWith(1, 1);
    });
  });

  it("allows dragging an Unchecked card into a day column", async () => {
    render(<App />);

    const sourceLink = screen.getByRole("link", { name: "never-reviewed" });
    const sourceCard = sourceLink.closest('[draggable="true"]');
    const targetLink = screen.getByRole("link", { name: "drag-target" });
    const targetCard = targetLink.closest('[draggable="true"]');

    expect(sourceCard).toBeTruthy();
    fireEvent.drop(targetCard, {
      dataTransfer: createDataTransfer(3),
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });

    await waitFor(() => {
      expect(api.setChecked).toHaveBeenCalledWith(3, 2);
    });
  });

  it("clears schedule when dropping a scheduled card onto Unchecked", async () => {
    render(<App />);

    const uncheckedLink = screen.getByRole("link", { name: "never-reviewed" });
    const uncheckedCard = uncheckedLink.closest('[draggable="true"]');

    fireEvent.drop(uncheckedCard, {
      dataTransfer: createDataTransfer(1),
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });

    await waitFor(() => {
      expect(api.clearSchedule).toHaveBeenCalledWith(1);
    });
  });
});
