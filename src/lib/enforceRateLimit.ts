import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rateLimit";

export interface RateLimitRule {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
  message?: string;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

// Returns a ready-to-send 429 response when the caller is over the limit,
// or null when the request may proceed.
export async function enforceRateLimit(
  rule: RateLimitRule
): Promise<NextResponse | null> {
  const result = await checkRateLimit(
    `${rule.scope}:${rule.subject}`,
    rule.limit,
    rule.windowMs
  );

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    { error: rule.message ?? "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) },
    }
  );
}
