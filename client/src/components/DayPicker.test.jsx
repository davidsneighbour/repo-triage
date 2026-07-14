import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayPicker } from "./DayPicker.jsx";

const columns = [
  {
    key: "day-0",
    title: "Today",
    subtitle: "needs review",
    accent: "rose",
    count: 2,
  },
  {
    key: "day-1",
    title: "Tuesday",
    subtitle: "tomorrow",
    accent: "amber",
    count: 0,
  },
  {
    key: "day-3",
    title: "Thursday",
    subtitle: "in 3 days",
    accent: "sky",
    count: 5,
  },
];

describe("DayPicker", () => {
  it("shows the active column title on the trigger button", () => {
    render(
      <DayPicker
        columns={columns}
        activeKey="day-1"
        onSelect={() => {
          /* no-op */
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Choose day, currently Tuesday/ }),
    ).toBeInTheDocument();
  });

  it("lists every column with its count when opened", () => {
    render(
      <DayPicker
        columns={columns}
        activeKey="day-0"
        onSelect={() => {
          /* no-op */
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Choose day/ }));

    const dialog = screen.getByRole("dialog", { name: "Choose day" });
    expect(dialog).toBeInTheDocument();
    for (const col of columns) {
      const row = within(dialog).getByRole("button", {
        name: new RegExp(col.title),
      });
      expect(row).toHaveTextContent(col.title);
      expect(row).toHaveTextContent(String(col.count));
    }
  });

  it("marks the active row with aria-current", () => {
    render(
      <DayPicker
        columns={columns}
        activeKey="day-3"
        onSelect={() => {
          /* no-op */
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Choose day/ }));
    const dialog = screen.getByRole("dialog", { name: "Choose day" });
    expect(
      within(dialog).getByRole("button", { name: /Thursday/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      within(dialog).getByRole("button", { name: /Today/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("calls onSelect and closes when a row is chosen", () => {
    const onSelect = vi.fn();
    render(
      <DayPicker columns={columns} activeKey="day-0" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Choose day/ }));
    const dialog = screen.getByRole("dialog", { name: "Choose day" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Thursday/ }));

    expect(onSelect).toHaveBeenCalledWith("day-3");
    expect(
      screen.queryByRole("dialog", { name: "Choose day" }),
    ).not.toBeInTheDocument();
  });

  it("clicking the backdrop overlay closes the picker", () => {
    render(
      <DayPicker
        columns={columns}
        activeKey="day-0"
        onSelect={() => {
          /* no-op */
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Choose day/ }));
    expect(
      screen.getByRole("dialog", { name: "Choose day" }),
    ).toBeInTheDocument();
    // Click the fixed backdrop overlay rendered behind the popup.
    const backdrop = document.querySelector(
      '[class*="fixed"][class*="inset-0"][class*="z-10"]',
    );
    fireEvent.click(backdrop);
    expect(
      screen.queryByRole("dialog", { name: "Choose day" }),
    ).not.toBeInTheDocument();
  });

  it("omits the subtitle row when a column has no subtitle", () => {
    // Unknown accent covers the ACCENT[col.accent] || ACCENT.neutral fallback branch.
    const noSubtitle = [
      { key: "x", title: "X", accent: "unknown-accent", count: 0 },
    ];
    render(
      <DayPicker
        columns={noSubtitle}
        activeKey="x"
        onSelect={() => {
          /* no-op */
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Choose day, currently X/ }),
    );
    expect(
      screen.getByRole("dialog", { name: "Choose day" }),
    ).toBeInTheDocument();
  });

  it('shows "no columns" and hides subtitle when active is undefined (empty column list)', () => {
    // Empty columns covers: || columns[0] fallback, aria-label false branch, ?? "no columns" branch.
    render(
      <DayPicker
        columns={[]}
        activeKey="any"
        onSelect={() => {
          /* no-op */
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Choose day" }),
    ).toBeInTheDocument();
    expect(screen.getByText("no columns")).toBeInTheDocument();
  });

  it("works for owner/tag/language buckets (any title, neutral accent)", () => {
    const buckets = [
      {
        key: "owner:me",
        title: "me",
        subtitle: "3 repos",
        accent: "neutral",
        count: 3,
      },
      {
        key: "owner:dnbhq",
        title: "dnbhq",
        subtitle: "1 repo",
        accent: "neutral",
        count: 1,
      },
    ];
    const onSelect = vi.fn();
    render(
      <DayPicker columns={buckets} activeKey="owner:me" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Choose day/ }));
    const dialog = screen.getByRole("dialog", { name: "Choose day" });
    fireEvent.click(within(dialog).getByRole("button", { name: /dnbhq/ }));
    expect(onSelect).toHaveBeenCalledWith("owner:dnbhq");
  });
});
