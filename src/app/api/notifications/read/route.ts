import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling } from "@/lib/apiError";
import { listUserProjects, markRead, markReadAcross } from "@/lib/notifications";

// Marks the signed-in person's own notifications as read: one task ({slug, issueId}),
// one project ({slug}), or everything ({}). Only their own rows are ever touched.
async function handlePOST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input = (typeof body === "object" && body !== null ? body : {}) as {
    slug?: unknown;
    issueId?: unknown;
  };
  const slug = typeof input.slug === "string" ? input.slug : null;
  const issueId = typeof input.issueId === "string" ? input.issueId : undefined;

  if (slug) {
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { schemaName: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updated = await markRead(project.schemaName, session.user.id, issueId);
    return NextResponse.json({ ok: true, updated });
  }

  const projects = await listUserProjects(session.user.id);
  const updated = await markReadAcross(projects, session.user.id);

  return NextResponse.json({ ok: true, updated });
}

export const POST = withApiErrorHandling(handlePOST);
