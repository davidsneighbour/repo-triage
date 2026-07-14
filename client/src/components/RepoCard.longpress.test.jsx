import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RepoCard } from "./RepoCard.jsx";

const repo = {
  id: 1,
  name: "widget",
  html_url: "https://x/widget",
  description: "a thing",
  private: false,
  archived: false,
  fork: false,
  language: "JS",
  pushed_at: "2026-06-01T00:00:00.000Z",
  checkedAgeDays: 0,
  dueInDays: 7,
  needsCheckToday: false,
  boardOffset: 0,
  tags: [],
};
const column = {
  key: "day-0",
  title: "Today",
  daysAgoTarget: 7,
  accent: "rose",
};

const renderCard = (props = {}) =>
  render(
    <RepoCard
      repo={repo}
      column={column}
      mobile
      schedulable
      onToggleMenu={() => {
        /* no-op */
      }}
      onDragStartCard={() => {
        /* no-op */
      }}
      onDropOnCard={() => {
        /* no-op */
      }}
      onSnooze={vi.fn()}
      defaultInactivity={7}
      {...props}
    />,
  );

describe("RepoCard long-press (mobile)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens the move sheet after the long-press threshold", () => {
    renderCard();
    const cardBody = screen.getByText("a thing");

    fireEvent.pointerDown(cardBody, { clientX: 5, clientY: 5 });
    expect(
      screen.queryByRole("dialog", { name: /Reschedule/ }),
    ).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(500));
    expect(
      screen.getByRole("dialog", { name: "Reschedule widget" }),
    ).toBeInTheDocument();
  });

  it("does not open on a plain tap (released before the threshold)", () => {
    renderCard();
    const cardBody = screen.getByText("a thing");

    fireEvent.pointerDown(cardBody, { clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerUp(cardBody);
    act(() => vi.advanceTimersByTime(500));

    expect(
      screen.queryByRole("dialog", { name: /Reschedule/ }),
    ).not.toBeInTheDocument();
  });

  it("cancels the press when the pointer moves past the threshold (a scroll)", () => {
    renderCard();
    const cardBody = screen.getByText("a thing");

    fireEvent.pointerDown(cardBody, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(cardBody, { clientX: 5, clientY: 80 });
    act(() => vi.advanceTimersByTime(500));

    expect(
      screen.queryByRole("dialog", { name: /Reschedule/ }),
    ).not.toBeInTheDocument();
  });

  it("applies the move via onSnooze and closes", () => {
    const onSnooze = vi.fn();
    renderCard({ onSnooze });
    const cardBody = screen.getByText("a thing");

    fireEvent.pointerDown(cardBody, { clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));

    fireEvent.change(screen.getByLabelText("Mark done for (days)"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));

    expect(onSnooze).toHaveBeenCalledWith(1, 10);
    expect(
      screen.queryByRole("dialog", { name: /Reschedule/ }),
    ).not.toBeInTheDocument();
  });

  it("does not arm a long-press on desktop (mobile flag off)", () => {
    renderCard({ mobile: false });
    const cardBody = screen.getByText("a thing");

    fireEvent.pointerDown(cardBody, { clientX: 5, clientY: 5 });
    act(() => vi.advanceTimersByTime(500));

    expect(
      screen.queryByRole("dialog", { name: /Reschedule/ }),
    ).not.toBeInTheDocument();
  });
});
