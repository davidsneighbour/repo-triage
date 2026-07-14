import { afterEach, describe, expect, it, vi } from "vitest";
import {
  devId,
  getElementIdentifier,
  isEditableTarget,
} from "./devIdOverlay.js";

function el(html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return wrapper.firstElementChild;
}

describe("getElementIdentifier", () => {
  it("returns null for a non-element", () => {
    expect(getElementIdentifier(null)).toBeNull();
    expect(getElementIdentifier(document.createTextNode("x"))).toBeNull();
  });

  it("prefers the element's own id", () => {
    expect(getElementIdentifier(el('<button id="save-btn"></button>'))).toBe(
      "#save-btn",
    );
  });

  it("does not use an ancestor id when the element itself has none (avoids resolving to the app-root id)", () => {
    const root = el(
      '<div id="card-1"><span class="wrapper"><em>text</em></span></div>',
    );
    const em = root.querySelector("em");
    expect(getElementIdentifier(em)).not.toBe("#card-1");
  });

  it("prefers data-id ahead of class names", () => {
    const node = el('<div data-id="RepoCard" class="rounded-md border"></div>');
    expect(getElementIdentifier(node)).toBe('[data-id="RepoCard"]');
  });

  it("prefers the element's own id ahead of data-id", () => {
    const node = el('<div id="save-btn" data-id="RepoCard"></div>');
    expect(getElementIdentifier(node)).toBe("#save-btn");
  });

  it("falls back to tag + up to two class names when no id is found", () => {
    const node = el(
      '<button class="rounded-md border text-neutral-300"></button>',
    );
    expect(getElementIdentifier(node)).toBe("button.rounded-md.border");
  });

  it("falls back to component metadata attributes when there is no id, data-id, or class", () => {
    const node = el('<div data-testid="repo-card"></div>');
    expect(getElementIdentifier(node)).toBe('[data-testid="repo-card"]');
  });

  it("checks data-slot before data-testid before data-component", () => {
    const node = el(
      '<div data-slot="header" data-testid="x" data-component="y"></div>',
    );
    expect(getElementIdentifier(node)).toBe('[data-slot="header"]');
  });

  it("falls back to the bare tag name when nothing else is available", () => {
    expect(getElementIdentifier(el("<section></section>"))).toBe("section");
  });
});

describe("devId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a data-id prop in development", () => {
    vi.stubEnv("DEV", true);
    expect(devId("RepoCard")).toEqual({ "data-id": "RepoCard" });
  });

  it("returns no props outside development (no production output)", () => {
    vi.stubEnv("DEV", false);
    expect(devId("RepoCard")).toEqual({});
  });
});

describe("isEditableTarget", () => {
  it("returns false for null", () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it.each([
    "INPUT",
    "TEXTAREA",
    "SELECT",
  ])("returns true for a %s element", (tag) => {
    expect(isEditableTarget({ tagName: tag })).toBe(true);
  });

  it("returns true for a contenteditable element", () => {
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(
      true,
    );
  });

  it("returns false for a plain button", () => {
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
  });
});
