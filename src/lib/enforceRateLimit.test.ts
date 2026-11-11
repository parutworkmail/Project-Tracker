import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));

vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));

import { enforceRateLimit, HOUR, MINUTE } from "./enforceRateLimit";

beforeEach(() => checkRateLimit.mockReset());

describe("enforceRateLimit", () => {
  it("returns null and namespaces the key when under the limit", async () => {
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });

    const result = await enforceRateLimit({
      scope: "issue-create",
      subject: "user-1",
      limit: 5,
      windowMs: MINUTE,
    });

    expect(result).toBeNull();
    expect(checkRateLimit).toHaveBeenCalledWith("issue-create:user-1", 5, MINUTE);
  });

  it("returns a 429 with Retry-After rounded up to whole seconds", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1500 });

    const result = await enforceRateLimit({
      scope: "x",
      subject: "u",
      limit: 1,
      windowMs: HOUR,
      message: "Slow down.",
    });

    expect(result?.status).toBe(429);
    expect(result?.headers.get("Retry-After")).toBe("2");
    expect(await result?.json()).toEqual({ error: "Slow down." });
  });

  it("uses a default message", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 0 });

    const result = await enforceRateLimit({
      scope: "x",
      subject: "u",
      limit: 1,
      windowMs: MINUTE,
    });

    expect(typeof (await result?.json()).error).toBe("string");
  });
});
