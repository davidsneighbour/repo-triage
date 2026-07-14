import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";

expect.extend(toHaveNoViolations);

import { resetViewport } from "./viewport.js";

afterEach(() => {
  cleanup();
  // Restore the default (desktop) viewport between tests so a mobile test
  // can't leak its breakpoint into the next one.
  resetViewport();
});

function createMemoryStorage() {
  const map = new Map();
  return {
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    get length() {
      return map.size;
    },
  };
}

const storage = createMemoryStorage();

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
  writable: true,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}
