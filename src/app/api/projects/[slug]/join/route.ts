import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { withApiErrorHandling } from "@/lib/apiError";

const JOIN_LIMIT = 20;
const JOIN_WINDOW_MS = 60 * 60 * 1000;

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`join:${ip}`, JOIN_LIMIT, JOIN_WINDOW_MS);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many join attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
      }
    );
  }

  const { slug } = await params;

  const project = await prisma.project.findUnique({ where: { slug } });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: session.user.id,
      },
    },
    create: {
      projectId: project.id,
      userId: session.user.id,
    },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export const POST = withApiErrorHandling(handlePOST);
