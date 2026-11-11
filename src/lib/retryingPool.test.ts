import { afterEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

import {
  RetryingPool,
  isRetryableConnectError,
  withConnectRetry,
} from "./retryingPool";

function networkError(code: string) {
  return Object.assign(new Error(`connect failed ${code}`), { code });
}

describe("isRetryableConnectError", () => {
  it("retries network-level connect failures", () => {
    for (const code of ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]) {
      expect(isRetryableConnectError(networkError(code))).toBe(true);
    }
  });

  it("retries pg connect timeouts", () => {
    expect(isRetryableConnectError(new Error("timeout exceeded when trying to connect"))).toBe(true);
    expect(isRetryableConnectError(new Error("Connection terminated due to connection timeout"))).toBe(true);
  });

  it("never retries auth failures, SQL errors or non-errors", () => {
    expect(isRetryableConnectError(Object.assign(new Error("password authentication failed"), { code: "28P01" }))).toBe(false);
    expect(isRetryableConnectError(Object.assign(new Error("relation does not exist"), { code: "42P01" }))).toBe(false);
    expect(isRetryableConnectError("ECONNRESET")).toBe(false);
    expect(isRetryableConnectError(null)).toBe(false);
  });
});

describe("withConnectRetry", () => {
  it("returns the first result without retrying on success", async () => {
    const attempt = vi.fn().mockResolvedValue("ok");

    expect(await withConnectRetry(attempt, 0)).toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once after a retryable failure", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(networkError("ECONNRESET"))
      .mockResolvedValueOnce("recovered");

    expect(await withConnectRetry(attempt, 0)).toBe("recovered");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("gives up after the single retry and surfaces the second error", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(networkError("ECONNRESET"))
      .mockRejectedValueOnce(new Error("timeout exceeded when trying to connect"));

    await expect(withConnectRetry(attempt, 0)).rejects.toThrow("timeout exceeded");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable error", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("bad password"), { code: "28P01" }));

    await expect(withConnectRetry(attempt, 0)).rejects.toThrow("bad password");
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

describe("RetryingPool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries once in the promise form", async () => {
    const fakeClient = { release: vi.fn() };
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockImplementationOnce(() => Promise.reject(networkError("ECONNRESET")))
      .mockImplementationOnce(() => Promise.resolve(fakeClient as never));
    const pool = new RetryingPool();

    expect(await pool.connect()).toBe(fakeClient);
    expect(spy).toHaveBeenCalledTimes(2);
    await pool.end();
  });

  it("retries once in the callback form (what pool.query uses)", async () => {
    const fakeClient = { release: vi.fn() };
    const done = vi.fn();
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockImplementationOnce(((callback: (e: Error | undefined) => void) => {
        callback(networkError("ECONNRESET"));
      }) as never)
      .mockImplementationOnce(((callback: (e: undefined, c: unknown, d: () => void) => void) => {
        callback(undefined, fakeClient, done);
      }) as never);
    const pool = new RetryingPool();

    const result = await new Promise<unknown>((resolve) => {
      pool.connect(((error: Error | undefined, client: unknown) => resolve({ error, client })) as never);
    });

    expect(result).toEqual({ error: undefined, client: fakeClient });
    expect(spy).toHaveBeenCalledTimes(2);
    await pool.end();
  });

  it("passes a non-retryable callback error straight through", async () => {
    const authError = Object.assign(new Error("password authentication failed"), { code: "28P01" });
    const spy = vi
      .spyOn(Pool.prototype, "connect")
      .mockImplementation(((callback: (e: Error) => void) => callback(authError)) as never);
    const pool = new RetryingPool();

    const error = await new Promise<unknown>((resolve) => {
      pool.connect(((e: Error | undefined) => resolve(e)) as never);
    });

    expect(error).toBe(authError);
    expect(spy).toHaveBeenCalledTimes(1);
    await pool.end();
  });
});
