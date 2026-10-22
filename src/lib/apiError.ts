import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { DbUnavailableError } from "@/lib/prisma";

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

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

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && CONNECTION_ERROR_CODES.has(code)) {
      return true;
    }
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
      return NextResponse.json(
        { error: "Internal server error." },
        { status: 500 }
      );
    }
  };
}
