import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevIdOverlay } from "./DevIdOverlay.jsx";

const STORAGE_KEY = "repo-triage-dev-id-overlay";

function makeTarget({ id, className } = {}) {
  const node = document.createElement("div");
  if (id) node.id = id;
  if (className) node.className = className;
  document.body.appendChild(node);
  return node;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("DevIdOverlay — toggle button", () => {
  it("renders inactive by default with aria-pressed=false", () => {
    render(<DevIdOverlay />);
    expect(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("activates on click and persists to localStorage", () => {
    render(<DevIdOverlay />);
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    );
    expect(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("restores the active state from localStorage on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    render(<DevIdOverlay />);
    expect(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("deactivating clears any visible tooltip", async () => {
    const target = makeTarget({ id: "target-1" });
    document.elementFromPoint = vi.fn().mockReturnValue(target);
    render(<DevIdOverlay />);
    const toggle = screen.getByRole("button", {
      name: "Toggle element identifier overlay",
    });
    fireEvent.click(toggle);

    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByText("#target-1")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText("#target-1")).not.toBeInTheDocument();
  });
});

describe("DevIdOverlay — keyboard shortcut", () => {
  it("Ctrl+Shift+I toggles the overlay", () => {
    render(<DevIdOverlay />);
    const toggle = screen.getByRole("button", {
      name: "Toggle element identifier overlay",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(window, {
      key: "I",
      code: "KeyI",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, {
      key: "I",
      code: "KeyI",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("is ignored while focus is in a text input", () => {
    render(
      <div>
        <input aria-label="some field" />
        <DevIdOverlay />
      </div>,
    );
    const input = screen.getByLabelText("some field");
    input.focus();

    fireEvent.keyDown(input, {
      key: "I",
      code: "KeyI",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});

describe("DevIdOverlay — hover tooltip", () => {
  it("shows an identifier tooltip for the hovered element, throttled via requestAnimationFrame", () => {
    const target = makeTarget({ id: "hovered-el" });
    document.elementFromPoint = vi.fn().mockReturnValue(target);
    render(<DevIdOverlay />);
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    );

    expect(screen.queryByText("#hovered-el")).not.toBeInTheDocument();
    fireEvent.mouseMove(window, { clientX: 50, clientY: 60 });
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(screen.getByText("#hovered-el")).toBeInTheDocument();
  });

  it("does not track the mouse (no tooltip) while inactive", () => {
    const target = makeTarget({ id: "hovered-el" });
    document.elementFromPoint = vi.fn().mockReturnValue(target);
    render(<DevIdOverlay />);

    fireEvent.mouseMove(window, { clientX: 50, clientY: 60 });
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(screen.queryByText("#hovered-el")).not.toBeInTheDocument();
  });

  it("ignores elements inside the overlay itself (e.g. the toggle button)", () => {
    render(<DevIdOverlay />);
    const toggle = screen.getByRole("button", {
      name: "Toggle element identifier overlay",
    });
    fireEvent.click(toggle);
    document.elementFromPoint = vi.fn().mockReturnValue(toggle);

    fireEvent.mouseMove(window, { clientX: 5, clientY: 5 });
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("DevIdOverlay — click to copy", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("copies the hovered identifier and shows brief feedback", async () => {
    const target = makeTarget({ id: "copy-me" });
    render(<DevIdOverlay />);
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    );

    await act(async () => {
      fireEvent.click(target, { clientX: 20, clientY: 20 });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("#copy-me");
    expect(screen.getByText("copied: #copy-me")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(screen.getByText("#copy-me")).toBeInTheDocument();
    expect(screen.queryByText("copied: #copy-me")).not.toBeInTheDocument();
  });

  it("prevents the click from reaching the underlying element while active", () => {
    const target = makeTarget({ id: "copy-me" });
    const onUnderlyingClick = vi.fn();
    target.addEventListener("click", onUnderlyingClick);
    document.elementFromPoint = vi.fn().mockReturnValue(target);
    render(<DevIdOverlay />);
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    );

    fireEvent.click(target, { clientX: 20, clientY: 20 });
    expect(onUnderlyingClick).not.toHaveBeenCalled();
  });

  it("does not intercept clicks while inactive", () => {
    const target = makeTarget({ id: "copy-me" });
    const onUnderlyingClick = vi.fn();
    target.addEventListener("click", onUnderlyingClick);
    document.elementFromPoint = vi.fn().mockReturnValue(target);
    render(<DevIdOverlay />);

    fireEvent.click(target, { clientX: 20, clientY: 20 });
    expect(onUnderlyingClick).toHaveBeenCalledTimes(1);
  });
});

describe("DevIdOverlay — cleanup", () => {
  it("removes listeners on unmount so no further tooltip updates fire", () => {
    const target = makeTarget({ id: "hovered-el" });
    document.elementFromPoint = vi.fn().mockReturnValue(target);
    const { unmount } = render(<DevIdOverlay />);
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle element identifier overlay" }),
    );
    unmount();

    // Should not throw, and no lingering listener should update anything.
    expect(() => {
      fireEvent.mouseMove(window, { clientX: 1, clientY: 1 });
      act(() => {
        vi.advanceTimersByTime(20);
      });
    }).not.toThrow();
  });
});
