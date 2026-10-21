import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitEntry" (key, count, "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "RateLimitEntry"."resetAt" <= ${now} THEN 1 ELSE "RateLimitEntry".count + 1 END,
      "resetAt" = CASE WHEN "RateLimitEntry"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimitEntry"."resetAt" END
    RETURNING count, "resetAt"
  `;

  const row = rows[0];
  const allowed = row.count <= limit;
  const retryAfterMs = allowed ? 0 : Math.max(0, row.resetAt.getTime() - now.getTime());

  return { allowed, retryAfterMs };
}

/**
 * Deployed on Vercel, which overwrites/sanitizes `x-forwarded-for` at the
 * edge and does not forward client-supplied values (prevents IP spoofing).
 * `x-vercel-forwarded-for` is Vercel's own guaranteed-authoritative variant,
 * checked first; `x-forwarded-for` is a safe fallback on that platform.
 * Do not rely on this ordering if self-hosting behind an untrusted proxy.
 */
export function getClientIp(request: Request): string {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(",")[0].trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}
