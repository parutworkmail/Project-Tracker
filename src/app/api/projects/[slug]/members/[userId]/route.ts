import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unassignUserIssues } from "@/lib/projectSchema";
import { canManageProject } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, userId } = await params;

  const project = await prisma.project.findUnique({ where: { slug } });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const isSelf = userId === session.user.id;

  if (!isSelf) {
    const canManage = await canManageProject(
      session.user.id,
      session.user.role,
      project.id
    );

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId } },
  });

  if (!membership) {
    return NextResponse.json(
      {
        error: isSelf
          ? "You are not a member of this project."
          : "Member not found",
      },
      { status: 404 }
    );
  }

  await unassignUserIssues(project.schemaName, userId);

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: project.id, userId } },
  });

  return NextResponse.json({ ok: true });
}

export const DELETE = withApiErrorHandling(handleDELETE);
