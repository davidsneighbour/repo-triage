import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initSentry,
  reactRootErrorHandlers,
  shouldInitSentry,
} from "./telemetry.js";

vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  reactErrorHandler: vi.fn(() => vi.fn()),
}));

describe("client telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not initialize Sentry without a client DSN", async () => {
    const Sentry = await import("@sentry/react");

    expect(initSentry({})).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("does not initialize Sentry when NO_TELEMETRY is truthy", async () => {
    const Sentry = await import("@sentry/react");

    expect(
      initSentry({
        VITE_SENTRY_DSN: "https://example@sentry.invalid/1",
        NO_TELEMETRY: "1",
      }),
    ).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry with privacy-preserving defaults when configured", async () => {
    const Sentry = await import("@sentry/react");

    expect(
      initSentry({ VITE_SENTRY_DSN: "https://example@sentry.invalid/1" }),
    ).toBe(true);

    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: "https://example@sentry.invalid/1",
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
  });

  it("builds React root error handlers only when telemetry is enabled", async () => {
    const Sentry = await import("@sentry/react");

    expect(shouldInitSentry({})).toBe(false);
    expect(reactRootErrorHandlers(false)).toBeUndefined();

    const handlers = reactRootErrorHandlers(true);
    expect(Object.keys(handlers)).toEqual([
      "onUncaughtError",
      "onCaughtError",
      "onRecoverableError",
    ]);
    expect(Sentry.reactErrorHandler).toHaveBeenCalledTimes(3);
  });
});
