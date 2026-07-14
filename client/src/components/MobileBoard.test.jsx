import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileBoard } from "./MobileBoard.jsx";

const makeCol = (key, title) => ({
  key,
  title,
  subtitle: "",
  accent: "neutral",
  repos: [],
  schedulable: true,
  daysAgoTarget: 0,
});

describe("MobileBoard", () => {
  it("renders the first column by default", () => {
    const cols = [makeCol("day-0", "Today"), makeCol("day-1", "Tomorrow")];
    render(<MobileBoard columns={cols} onDropColumn={vi.fn()} />);
    expect(
      screen.getByRole("group", { name: /Today column/ }),
    ).toBeInTheDocument();
  });

  it("falls back to the first remaining column when the active column is removed", () => {
    const cols = [makeCol("day-0", "Today"), makeCol("day-1", "Tomorrow")];
    const { rerender } = render(
      <MobileBoard columns={cols} onDropColumn={vi.fn()} />,
    );
    // The active column is day-0 (Today). Remove it.
    rerender(
      <MobileBoard
        columns={[makeCol("day-1", "Tomorrow")]}
        onDropColumn={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("group", { name: /Tomorrow column/ }),
    ).toBeInTheDocument();
  });
});
