import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling } from "@/lib/apiError";
import {
  countUnread,
  countUnreadAcross,
  listUserProjects,
} from "@/lib/notifications";

// Unread notifications for the signed-in person: for one project when ?slug= is
// given, otherwise across every project they belong to.
async function handleGET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = new URL(request.url).searchParams.get("slug");

  if (slug) {
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { schemaName: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(
      { count: await countUnread(project.schemaName, session.user.id) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const projects = await listUserProjects(session.user.id);

  return NextResponse.json(
    { count: await countUnreadAcross(projects, session.user.id) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const GET = withApiErrorHandling(handleGET);
