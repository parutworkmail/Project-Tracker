import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRaw,
  },
}));

import { checkRateLimit, getClientIp } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("allows the request when count is within the limit", async () => {
    queryRaw.mockResolvedValue([{ count: 3, resetAt: new Date(Date.now() + 60_000) }]);

    const result = await checkRateLimit("key-1", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("allows the request when count exactly equals the limit", async () => {
    queryRaw.mockResolvedValue([{ count: 5, resetAt: new Date(Date.now() + 60_000) }]);

    const result = await checkRateLimit("key-1", 5, 60_000);

    expect(result.allowed).toBe(true);
  });

  it("denies the request when count exceeds the limit", async () => {
    const resetAt = new Date(Date.now() + 30_000);
    queryRaw.mockResolvedValue([{ count: 6, resetAt }]);

    const result = await checkRateLimit("key-1", 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(30_000);
  });

  it("clamps retryAfterMs to 0 if resetAt has already passed", async () => {
    queryRaw.mockResolvedValue([{ count: 10, resetAt: new Date(Date.now() - 1000) }]);

    const result = await checkRateLimit("key-1", 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(0);
  });
});

describe("checkRateLimit (stateful simulation of the real SQL upsert)", () => {
  // Mirrors the actual INSERT...ON CONFLICT DO UPDATE...CASE logic in
  // rateLimit.ts against an in-memory table, driven by a controllable clock,
  // to prove the window-reset behavior works across multiple real calls
  // (not just against a single canned mock response).
  beforeEach(() => {
    vi.useFakeTimers();
    const store = new Map<string, { count: number; resetAt: Date }>();
    queryRaw.mockReset();
    queryRaw.mockImplementation(
      async (_strings: unknown, key: string, resetAt: Date, now: Date) => {
        const existing = store.get(key);
        let count: number;
        let effectiveResetAt: Date;

        if (!existing || existing.resetAt.getTime() <= now.getTime()) {
          count = 1;
          effectiveResetAt = resetAt;
        } else {
          count = existing.count + 1;
          effectiveResetAt = existing.resetAt;
        }

        store.set(key, { count, resetAt: effectiveResetAt });
        return [{ count, resetAt: effectiveResetAt }];
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("increments on each call within the same window and enforces the limit", async () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const limit = 3;
    const windowMs = 1000;
    const key = "stateful-key";

    expect((await checkRateLimit(key, limit, windowMs)).allowed).toBe(true);
    expect((await checkRateLimit(key, limit, windowMs)).allowed).toBe(true);
    expect((await checkRateLimit(key, limit, windowMs)).allowed).toBe(true);
    expect((await checkRateLimit(key, limit, windowMs)).allowed).toBe(false);
  });

  it("resets the counter once the window has actually elapsed", async () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const limit = 2;
    const windowMs = 1000;
    const key = "stateful-reset-key";

    expect((await checkRateLimit(key, limit, windowMs)).allowed).toBe(true);
    expect((await checkRateLimit(key, limit, windowMs)).allowed).toBe(true);
    expect((await checkRateLimit(key, limit, windowMs)).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.500Z"));

    const afterReset = await checkRateLimit(key, limit, windowMs);
    expect(afterReset.allowed).toBe(true);
  });

  it("tracks separate keys independently", async () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const limit = 1;
    const windowMs = 1000;

    expect((await checkRateLimit("key-a", limit, windowMs)).allowed).toBe(true);
    expect((await checkRateLimit("key-a", limit, windowMs)).allowed).toBe(false);
    expect((await checkRateLimit("key-b", limit, windowMs)).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers x-vercel-forwarded-for over x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-vercel-forwarded-for": "1.1.1.1",
        "x-forwarded-for": "2.2.2.2",
      },
    });

    expect(getClientIp(request)).toBe("1.1.1.1");
  });

  it("uses the first entry in x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });

    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("https://example.com", {
      headers: { "x-real-ip": "9.8.7.6" },
    });

    expect(getClientIp(request)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const request = new Request("https://example.com");

    expect(getClientIp(request)).toBe("unknown");
  });
});
