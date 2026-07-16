import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

async function loadTelemetry() {
  vi.resetModules();
  return import("./lib/telemetry.js");
}

describe("server telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not initialize Sentry without a DSN", async () => {
    const Sentry = await import("@sentry/node");
    const telemetry = await loadTelemetry();

    expect(telemetry.initSentry({})).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(telemetry.isSentryInitialized()).toBe(false);
  });

  it("does not initialize Sentry when NO_TELEMETRY is truthy", async () => {
    const Sentry = await import("@sentry/node");
    const telemetry = await loadTelemetry();

    expect(
      telemetry.initSentry({
        SENTRY_DSN: "https://example@sentry.invalid/1",
        NO_TELEMETRY: "true",
      }),
    ).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry with privacy-preserving defaults when configured", async () => {
    const Sentry = await import("@sentry/node");
    const telemetry = await loadTelemetry();

    expect(
      telemetry.initSentry({
        SENTRY_DSN: "https://example@sentry.invalid/1",
      }),
    ).toBe(true);

    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: "https://example@sentry.invalid/1",
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    expect(telemetry.isSentryInitialized()).toBe(true);
  });

  it("captures explicit exceptions only after Sentry is initialized", async () => {
    const Sentry = await import("@sentry/node");
    const telemetry = await loadTelemetry();
    const error = new Error("boom");

    telemetry.captureException(error);
    expect(Sentry.captureException).not.toHaveBeenCalled();

    telemetry.initSentry({ SENTRY_DSN: "https://example@sentry.invalid/1" });
    telemetry.captureException(error, { tags: { area: "sync" } });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { area: "sync" },
    });
  });
});

describe("Express error handling", () => {
  it("serializes errors with safe status codes", async () => {
    const { handleError } = await import("./index.js");
    const res = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    handleError(
      Object.assign(new Error("not found"), { status: 404 }),
      {},
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "not found" });
  });

  it("uses 500 for invalid status codes", async () => {
    const { handleError } = await import("./index.js");
    const res = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    handleError(
      Object.assign(new Error("bad status"), { status: 200 }),
      {},
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "bad status" });
  });

  it("delegates when headers were already sent", async () => {
    const { handleError } = await import("./index.js");
    const err = new Error("late failure");
    const next = vi.fn();

    handleError(err, {}, { headersSent: true }, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
