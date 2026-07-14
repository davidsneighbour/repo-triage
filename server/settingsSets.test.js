import { describe, expect, it } from "vitest";
import {
  evaluatePreset,
  findPreset,
  getSettingsSets,
} from "./lib/settingsSets.js";

describe("getSettingsSets", () => {
  it("lists the built-in hygiene preset as a summary (no check details)", () => {
    const presets = getSettingsSets();
    expect(presets).toEqual([
      {
        id: "hygiene",
        name: "Repo hygiene",
        description: expect.any(String),
        checkCount: 5,
      },
    ]);
  });
});

describe("findPreset", () => {
  it("returns the full preset including checks", () => {
    const preset = findPreset("hygiene");
    expect(preset.id).toBe("hygiene");
    expect(preset.checks).toHaveLength(5);
  });

  it("returns null for an unknown preset id", () => {
    expect(findPreset("does-not-exist")).toBeNull();
  });
});

describe("evaluatePreset", () => {
  const preset = findPreset("hygiene");

  it("passes every check for a fully hygienic repo", () => {
    const repo = {
      description: "a repo",
      license: "MIT",
      topics: ["cli"],
      has_issues: true,
      has_wiki: false,
    };
    const result = evaluatePreset(repo, preset);
    expect(result).toMatchObject({
      presetId: "hygiene",
      presetName: "Repo hygiene",
      passCount: 5,
      total: 5,
    });
    expect(result.checks.every((c) => c.pass)).toBe(true);
  });

  it("fails every check for a bare repo", () => {
    const repo = {
      description: null,
      license: null,
      topics: [],
      has_issues: false,
      has_wiki: true,
    };
    const result = evaluatePreset(repo, preset);
    expect(result.passCount).toBe(0);
    expect(result.total).toBe(5);
  });

  it("scores a partially hygienic repo correctly", () => {
    const repo = {
      description: "has one",
      license: null,
      topics: [],
      has_issues: true,
      has_wiki: true,
    };
    const result = evaluatePreset(repo, preset);
    expect(result.passCount).toBe(2); // has_description, issues_enabled
    expect(result.checks.find((c) => c.id === "has_description").pass).toBe(
      true,
    );
    expect(result.checks.find((c) => c.id === "has_license").pass).toBe(false);
    expect(result.checks.find((c) => c.id === "wiki_disabled").pass).toBe(
      false,
    );
  });

  it("treats whitespace-only strings as empty for nonEmpty checks", () => {
    const repo = {
      description: "   ",
      license: null,
      topics: [],
      has_issues: false,
      has_wiki: false,
    };
    const result = evaluatePreset(repo, preset);
    expect(result.checks.find((c) => c.id === "has_description").pass).toBe(
      false,
    );
  });

  it("falls back to a failing check for an unknown evaluator type", () => {
    const brokenPreset = {
      id: "broken",
      name: "Broken",
      checks: [{ id: "x", label: "x", field: "x", type: "no-such-evaluator" }],
    };
    const result = evaluatePreset({ x: "anything" }, brokenPreset);
    expect(result.checks).toEqual([{ id: "x", label: "x", pass: false }]);
  });
});
