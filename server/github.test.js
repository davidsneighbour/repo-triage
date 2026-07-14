import { describe, expect, it } from "vitest";
import { parseRateLimitHeaders } from "./github.js";

function createResponse(headers) {
  return {
    headers: {
      get(key) {
        return headers[key] ?? null;
      },
    },
  };
}

describe("parseRateLimitHeaders", () => {
  it("maps rate-limit headers to target object", () => {
    const target = {
      limit: null,
      remaining: null,
      used: null,
      reset: null,
      lastChecked: null,
    };

    parseRateLimitHeaders(
      createResponse({
        "x-ratelimit-limit": "5000",
        "x-ratelimit-remaining": "4920",
        "x-ratelimit-used": "80",
        "x-ratelimit-reset": "1700000000",
      }),
      target,
    );

    expect(target.limit).toBe(5000);
    expect(target.remaining).toBe(4920);
    expect(target.used).toBe(80);
    expect(target.reset).toBe(1700000000);
    expect(typeof target.lastChecked).toBe("string");
  });

  it("does not overwrite existing values when headers are missing", () => {
    const target = {
      limit: 100,
      remaining: 99,
      used: 1,
      reset: 123,
      lastChecked: null,
    };

    parseRateLimitHeaders(createResponse({}), target);

    expect(target.limit).toBe(100);
    expect(target.remaining).toBe(99);
    expect(target.used).toBe(1);
    expect(target.reset).toBe(123);
    expect(typeof target.lastChecked).toBe("string");
  });
});
