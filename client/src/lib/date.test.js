import { describe, expect, it } from "vitest";
import { calendarLabel, timeAgo } from "./date.js";

describe("timeAgo", () => {
  it("returns never when no timestamp is provided", () => {
    expect(timeAgo(null)).toBe("never");
  });

  it("formats minute and day boundaries", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(timeAgo(new Date(now - 5 * 60 * 1000).toISOString(), now)).toBe(
      "5m ago",
    );
    expect(timeAgo(new Date(now - 3 * 86400000).toISOString(), now)).toBe(
      "3d ago",
    );
  });

  it("returns just now for small durations", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(timeAgo(new Date(now - 5000).toISOString(), now)).toBe("just now");
  });
});

describe("calendarLabel", () => {
  const baseDate = new Date("2026-01-07T10:00:00.000Z");

  it("returns today label for offset 0", () => {
    expect(calendarLabel(0, baseDate)).toEqual({
      title: "Today",
      subtitle: "needs review",
    });
  });

  it("leads with the relative phrase and keeps the weekday as subtitle", () => {
    // baseDate is a Wednesday, so offset 1 is Thursday, offset 2 Friday.
    expect(calendarLabel(1, baseDate)).toEqual({
      title: "Tomorrow",
      subtitle: "Thursday",
    });
    expect(calendarLabel(2, baseDate)).toEqual({
      title: "Day after",
      subtitle: "Friday",
    });
  });

  it("returns generic future label for offsets > 2", () => {
    expect(calendarLabel(4, baseDate).title).toBe("In 4 days");
  });
});
