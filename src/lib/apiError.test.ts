import { describe, expect, it } from "vitest";

import { DbUnavailableError } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isDbConnectionError, withApiErrorHandling } from "./apiError";

describe("isDbConnectionError", () => {
  it("returns true for DbUnavailableError", () => {
    expect(isDbConnectionError(new DbUnavailableError("missing env var"))).toBe(
      true
    );
  });

  it("returns true for Prisma.PrismaClientInitializationError", () => {
    const error = new Prisma.PrismaClientInitializationError(
      "cannot reach database",
      "test"
    );
    expect(isDbConnectionError(error)).toBe(true);
  });

  it("returns true for Prisma.PrismaClientRustPanicError", () => {
    const error = new Prisma.PrismaClientRustPanicError("panic", "test");
    expect(isDbConnectionError(error)).toBe(true);
  });

  it("returns true for Prisma.PrismaClientUnknownRequestError", () => {
    const error = new Prisma.PrismaClientUnknownRequestError("unknown", {
      clientVersion: "test",
    });
    expect(isDbConnectionError(error)).toBe(true);
  });

  it("returns true for PrismaClientKnownRequestError with code P2010 (raw query failed to reach the server)", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Raw query failed. Code: `N/A`. Message: `Can't reach database server`",
      { code: "P2010", clientVersion: "test" }
    );
    expect(isDbConnectionError(error)).toBe(true);
  });

  it("returns false for PrismaClientKnownRequestError with an unrelated code", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test" }
    );
    expect(isDbConnectionError(error)).toBe(false);
  });

  it("returns true when a nested driverAdapterError.message contains DatabaseNotReachable (matches a real production log)", () => {
    const driverAdapterError = new Error(
      "DriverAdapterError: DatabaseNotReachable"
    );
    const error = new Prisma.PrismaClientKnownRequestError("Raw query failed", {
      code: "P2010",
      clientVersion: "test",
      meta: { driverAdapterError },
    });
    expect(isDbConnectionError(error)).toBe(true);
  });

  it("returns true when DatabaseNotReachable is nested under .cause instead of .meta", () => {
    const cause = new Error("DatabaseNotReachable");
    const error = Object.assign(new Error("wrapper"), { cause });
    expect(isDbConnectionError(error)).toBe(true);
  });

  it.each(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH"])(
    "returns true for a raw error with code %s",
    (code) => {
      const error = Object.assign(new Error("network error"), { code });
      expect(isDbConnectionError(error)).toBe(true);
    }
  );

  it("returns false for an unrelated error code", () => {
    const error = Object.assign(new Error("not found"), { code: "P2025" });
    expect(isDbConnectionError(error)).toBe(false);
  });

  it("returns false for a plain Error with no code", () => {
    expect(isDbConnectionError(new Error("something else"))).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isDbConnectionError("just a string")).toBe(false);
    expect(isDbConnectionError(null)).toBe(false);
    expect(isDbConnectionError(undefined)).toBe(false);
    expect(isDbConnectionError(42)).toBe(false);
  });
});

describe("withApiErrorHandling", () => {
  it("rethrows Next.js internal control-flow errors (digest-tagged) untouched", async () => {
    const nextInternalError = Object.assign(
      new Error("NEXT_REDIRECT"),
      { digest: "NEXT_REDIRECT;replace;/login;307;" }
    );
    const handler = withApiErrorHandling(async () => {
      throw nextInternalError;
    });

    await expect(handler(new Request("http://localhost"))).rejects.toBe(
      nextInternalError
    );
  });

  it("rethrows prerendering-bailout-shaped errors (any string digest)", async () => {
    const prerenderError = Object.assign(new Error("bailout"), {
      digest: "NEXT_PRERENDER_INTERRUPTED",
    });
    const handler = withApiErrorHandling(async () => {
      throw prerenderError;
    });

    await expect(handler(new Request("http://localhost"))).rejects.toBe(
      prerenderError
    );
  });

  it("passes through a successful response unchanged", async () => {
    const handler = withApiErrorHandling(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const response = await handler(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("forwards extra args to the wrapped handler", async () => {
    const handler = withApiErrorHandling(
      async (_request: Request, extra: string) => {
        return new Response(JSON.stringify({ extra }), { status: 200 });
      }
    );

    const response = await handler(new Request("http://localhost"), "hello");
    const body = await response.json();

    expect(body).toEqual({ extra: "hello" });
  });

  it("returns 503 with a clean message when a DB connection error is thrown", async () => {
    const handler = withApiErrorHandling(async () => {
      throw new DbUnavailableError("missing env var");
    });

    const response = await handler(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(typeof body.error).toBe("string");
  });

  it("returns 500 with a clean message (no raw error details) for any other error", async () => {
    const handler = withApiErrorHandling(async () => {
      throw new Error("some unexpected bug with a secret stack trace");
    });

    const response = await handler(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(typeof body.error).toBe("string");
    expect(body.error).not.toContain("secret stack trace");
  });
});
