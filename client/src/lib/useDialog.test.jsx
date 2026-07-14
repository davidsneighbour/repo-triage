import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDialog } from "./useDialog.js";

function Dialog({ onClose, withButtons = true }) {
  const ref = useDialog(onClose);
  return (
    <div ref={ref} role="dialog" tabIndex={-1} aria-label="test">
      {withButtons && (
        <>
          <button>first</button>
          <button>last</button>
        </>
      )}
    </div>
  );
}

describe("useDialog focus trap", () => {
  it("moves focus into the panel on open", () => {
    render(
      <Dialog
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  });

  it("wraps Tab from the last element back to the first", () => {
    render(
      <Dialog
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    const last = screen.getByRole("button", { name: "last" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    render(
      <Dialog
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    const first = screen.getByRole("button", { name: "first" });
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
  });

  it("keeps focus on the panel when there are no focusable children", () => {
    render(
      <Dialog
        onClose={() => {
          /* no-op */
        }}
        withButtons={false}
      />,
    );
    const panel = screen.getByRole("dialog");
    fireEvent.keyDown(panel, { key: "Tab" });
    expect(panel).toHaveFocus();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
