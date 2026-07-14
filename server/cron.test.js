import { describe, expect, it } from "vitest";
import { parseCron } from "./lib/cron.js";

// Construct dates in local time so getHours()/getMinutes() match the cron fields.
const local = (year, month, day, hour, min) =>
  new Date(year, month - 1, day, hour, min, 0);

describe("parseCron", () => {
  it("throws for wrong field count", () => {
    expect(() => parseCron("* * * *")).toThrow(/5 fields/);
    expect(() => parseCron("* * * * * *")).toThrow(/5 fields/);
  });

  it("* matches everything", () => {
    const match = parseCron("* * * * *");
    expect(match(local(2026, 6, 13, 12, 34))).toBe(true);
  });

  it("exact values", () => {
    const match = parseCron("30 8 13 6 6"); // 08:30 on June 13 (Saturday)
    const sat = local(2026, 6, 13, 8, 30);
    expect(sat.getDay()).toBe(6); // verify Saturday
    expect(match(sat)).toBe(true);
    expect(match(local(2026, 6, 13, 8, 31))).toBe(false);
    expect(match(local(2026, 6, 13, 9, 30))).toBe(false);
  });

  it("*/N step (*/15 minutes)", () => {
    const match = parseCron("*/15 * * * *");
    expect(match(local(2026, 6, 13, 10, 0))).toBe(true);
    expect(match(local(2026, 6, 13, 10, 15))).toBe(true);
    expect(match(local(2026, 6, 13, 10, 30))).toBe(true);
    expect(match(local(2026, 6, 13, 10, 7))).toBe(false);
  });

  it("range (1-5 weekdays)", () => {
    const match = parseCron("0 8 * * 1-5");
    const saturday = local(2026, 6, 13, 8, 0); // day 6
    expect(saturday.getDay()).toBe(6);
    expect(match(saturday)).toBe(false);
    const monday = local(2026, 6, 15, 8, 0); // day 1
    expect(monday.getDay()).toBe(1);
    expect(match(monday)).toBe(true);
  });

  it("comma-separated list", () => {
    const match = parseCron("0 9,17 * * *");
    expect(match(local(2026, 6, 13, 9, 0))).toBe(true);
    expect(match(local(2026, 6, 13, 17, 0))).toBe(true);
    expect(match(local(2026, 6, 13, 10, 0))).toBe(false);
  });

  it("treats dow 7 as Sunday (same as 0)", () => {
    const matchWith7 = parseCron("0 0 * * 7");
    const matchWith0 = parseCron("0 0 * * 0");
    const sunday = local(2026, 6, 14, 0, 0); // June 14 2026 is a Sunday
    expect(sunday.getDay()).toBe(0);
    expect(matchWith7(sunday)).toBe(true);
    expect(matchWith0(sunday)).toBe(true);
  });

  it("throws on invalid step", () => {
    expect(() => parseCron("*/0 * * * *")).toThrow();
  });
});
