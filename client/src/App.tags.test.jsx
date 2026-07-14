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
    setInactivity: vi.fn(),
    reorder: vi.fn(),
    addTag: vi.fn(),
    removeTag: vi.fn(),
    deleteTag: vi.fn(),
    createTag: vi.fn(),
    renameTag: vi.fn(),
  },
}));

const card = (id, name, tags) => ({
  id,
  name,
  full_name: `me/${name}`,
  html_url: `https://x/${name}`,
  description: "",
  private: false,
  archived: false,
  fork: false,
  language: "JS",
  pushed_at: "2026-06-01T00:00:00.000Z",
  checkedAgeDays: 0,
  dueInDays: 7,
  needsCheckToday: false,
  column: "day-0",
  position: id,
  tags,
});

const payload = {
  repos: [card(1, "alpha", ["infra"]), card(2, "beta", ["oss"])],
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

describe("tags UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    api.list.mockResolvedValue(payload);
    api.getTags.mockResolvedValue({
      tags: [
        { tag: "infra", count: 1 },
        { tag: "oss", count: 1 },
      ],
    });
    api.addTag.mockResolvedValue({ ok: true });
    api.removeTag.mockResolvedValue({ ok: true });
    api.deleteTag.mockResolvedValue({ ok: true });
    api.createTag.mockResolvedValue({ ok: true });
    api.renameTag.mockResolvedValue({ ok: true });
  });

  it("renders tag chips on cards", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });
    expect(screen.getByText("#infra")).toBeInTheDocument();
    expect(screen.getByText("#oss")).toBeInTheDocument();
  });

  it("adds a tag from the card menu", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Open repository settings" })[0],
    );
    fireEvent.change(screen.getByLabelText("New tag"), {
      target: { value: "db" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));

    await waitFor(() => expect(api.addTag).toHaveBeenCalledWith(1, "db"));
  });

  it('exposes a per-card "+ tag" affordance that opens the menu focused on the tag input', async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    // The affordance is visible on the card without opening the settings menu.
    const addBtn = screen.getByRole("button", { name: "Add tag to alpha" });
    fireEvent.click(addBtn);

    const input = await screen.findByLabelText("New tag");
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: "db" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));
    await waitFor(() => expect(api.addTag).toHaveBeenCalledWith(1, "db"));
  });

  it('opens a tag-only menu from the "+ tag" affordance (no review-timing controls)', async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Add tag to alpha" }));
    // The tag input is present...
    expect(await screen.findByLabelText("New tag")).toBeInTheDocument();
    // ...but the full settings sections are not.
    expect(
      screen.queryByRole("button", { name: "Checked now" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move to Today" }),
    ).not.toBeInTheDocument();
  });

  it("deletes a tag everywhere from the tag-filter dropdown (after inline confirm)", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete tag infra" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(api.deleteTag).toHaveBeenCalledWith("infra", false),
    );
  });

  it("cancelling the inline delete confirm does not call the API", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete tag infra" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("button", { name: "Delete tag infra" }),
    ).toBeInTheDocument();
    expect(api.deleteTag).not.toHaveBeenCalled();
  });

  it("deletes a tag and resets check status when the checkbox is checked", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete tag infra" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /also reset check status/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(api.deleteTag).toHaveBeenCalledWith("infra", true),
    );
  });

  it("creates a tag from the tag-filter dropdown", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag" }));
    fireEvent.change(screen.getByLabelText("New tag name"), {
      target: { value: "security" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

    await waitFor(() => expect(api.createTag).toHaveBeenCalledWith("security"));
  });

  it("renames a tag from the tag-filter dropdown", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Rename tag infra" }),
    );
    const input = screen.getByLabelText("Rename infra");
    fireEvent.change(input, { target: { value: "platform" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rename" }));

    await waitFor(() =>
      expect(api.renameTag).toHaveBeenCalledWith("infra", "platform"),
    );
  });

  it("filters the board by a selected tag", async () => {
    render(<App />);
    await screen.findByRole("link", { name: "alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Filter by tag" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /infra/i }));

    expect(screen.getByRole("link", { name: "alpha" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "beta" }),
    ).not.toBeInTheDocument();
  });
});
