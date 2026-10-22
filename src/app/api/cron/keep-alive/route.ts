import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withApiErrorHandling } from "@/lib/apiError";

async function handleGET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$queryRaw`SELECT 1`;

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}

export const GET = withApiErrorHandling(handleGET);
