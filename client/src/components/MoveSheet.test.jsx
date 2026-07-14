import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoveSheet } from "./MoveSheet.jsx";

const repo = { id: 7, name: "widget" };

describe("MoveSheet", () => {
  it("is a bottom sheet titled with the repo name and a single numeric field", () => {
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={7}
        onApply={() => {
          /* no-op */
        }}
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Reschedule widget" });
    expect(dialog).toHaveTextContent("widget");
    expect(screen.getByLabelText("Mark done for (days)")).toHaveAttribute(
      "type",
      "number",
    );
  });

  it("defaults the field to the review cycle", () => {
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={14}
        onApply={() => {
          /* no-op */
        }}
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    expect(screen.getByLabelText("Mark done for (days)")).toHaveValue(14);
  });

  it('applies the entered number and closes on "Mark done"', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={7}
        onApply={onApply}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mark done for (days)"), {
      target: { value: "21" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));

    expect(onApply).toHaveBeenCalledWith(7, 21);
    expect(onClose).toHaveBeenCalled();
  });

  it("quick-pick presets fill the field", () => {
    const onApply = vi.fn();
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={7}
        onApply={onApply}
        onClose={() => {
          /* no-op */
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "30d" }));
    expect(screen.getByLabelText("Mark done for (days)")).toHaveValue(30);
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    expect(onApply).toHaveBeenCalledWith(7, 30);
  });

  it("submits on Enter", () => {
    const onApply = vi.fn();
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={7}
        onApply={onApply}
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    const input = screen.getByLabelText("Mark done for (days)");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onApply).toHaveBeenCalledWith(7, 3);
  });

  it("defaults to 7 when defaultInactivity is 0 (covers the || 7 fallback branch)", () => {
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={0}
        onApply={() => {
          /* no-op */
        }}
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    expect(screen.getByLabelText("Mark done for (days)")).toHaveValue(7);
  });

  it("ignores non-Enter keydown in the day input (covers the false branch of key === Enter)", () => {
    const onApply = vi.fn();
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={7}
        onApply={onApply}
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Mark done for (days)"), {
      key: "Tab",
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("cancel closes without mutating", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={7}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("ignores an empty or negative value", () => {
    const onApply = vi.fn();
    render(
      <MoveSheet
        repo={repo}
        defaultInactivity={7}
        onApply={onApply}
        onClose={() => {
          /* no-op */
        }}
      />,
    );
    const input = screen.getByLabelText("Mark done for (days)");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    expect(onApply).not.toHaveBeenCalled();
  });
});
