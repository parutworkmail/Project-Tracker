import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { DbUnavailableError } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

// Messages node-postgres / pg-pool use when the connection could not be opened or
// was cut (they carry no error code), e.g. "Connection terminated due to
// connection timeout" from a pool that never got a connection.
const CONNECTION_MESSAGE_PATTERN =
  /connection terminated|connection timeout|timeout expired|server closed the connection|can.t reach database server|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ENETUNREACH/i;

// Next.js implements redirect()/notFound()/forbidden()/unauthorized() and
// its own build-time prerendering bailout signals by throwing errors
// tagged with a string `digest` property (e.g. NEXT_REDIRECT,
// NEXT_NOT_FOUND, NEXT_PRERENDER_INTERRUPTED, HANGING_PROMISE_REJECTION).
// These must always propagate untouched - never caught/converted by
// application error handling. See Next's own catchError docs: "APIs like
// redirect() and notFound() work by throwing special errors under the
// hood... so they're not accidentally caught by your error boundary."
function isNextInternalControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  return typeof (error as { digest?: unknown }).digest === "string";
}

export function isDbConnectionError(error: unknown): boolean {
  if (error instanceof DbUnavailableError) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return true;
  }

  // P2010: "Raw query failed" - the driver adapter (pg) couldn't even
  // reach the server (as opposed to the query itself being invalid).
  // Confirmed from a real production log: the underlying
  // DriverAdapterError.message was literally "DatabaseNotReachable",
  // nested under error.meta.driverAdapterError, not a top-level code.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010"
  ) {
    return true;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && CONNECTION_ERROR_CODES.has(code)) {
      return true;
    }
  }

  if (hasNestedDatabaseNotReachableCause(error)) {
    return true;
  }

  return false;
}

// Walks a possibly-nested `meta.driverAdapterError`/`cause` chain looking
// for the driver adapter's own "can't reach the database" signal, which
// doesn't surface as a top-level error code or class.
function hasNestedDatabaseNotReachableCause(
  error: unknown,
  depth = 0
): boolean {
  if (depth > 5 || typeof error !== "object" || error === null) {
    return false;
  }

  const err = error as {
    message?: unknown;
    meta?: { driverAdapterError?: unknown };
    cause?: unknown;
  };

  if (
    typeof err.message === "string" &&
    (err.message.includes("DatabaseNotReachable") ||
      CONNECTION_MESSAGE_PATTERN.test(err.message))
  ) {
    return true;
  }

  const nestedCode = (error as { code?: unknown }).code;
  if (typeof nestedCode === "string" && CONNECTION_ERROR_CODES.has(nestedCode)) {
    return true;
  }

  if (hasNestedDatabaseNotReachableCause(err.meta?.driverAdapterError, depth + 1)) {
    return true;
  }

  if (hasNestedDatabaseNotReachableCause(err.cause, depth + 1)) {
    return true;
  }

  return false;
}

export function withApiErrorHandling<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (isNextInternalControlFlowError(error)) {
        throw error;
      }

      if (isDbConnectionError(error)) {
        console.error("Database connection error:", error);
        return NextResponse.json(
          {
            error:
              "Database is currently unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }

      console.error("Unhandled API error:", error);

      let path = "";
      try {
        path = new URL(request.url).pathname;
      } catch {
        path = "";
      }

      // Not written for database outages (above): the database is what is down.
      await recordAudit({
        level: "ERROR",
        category: "system",
        action: "api.error",
        message: `${request.method} ${path} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        target: path,
        meta: {
          method: request.method,
          error: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : undefined,
        },
      });

      return NextResponse.json(
        { error: "Internal server error." },
        { status: 500 }
      );
    }
  };
}
