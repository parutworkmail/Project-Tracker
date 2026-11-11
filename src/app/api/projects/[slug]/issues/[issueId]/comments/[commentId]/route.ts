import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteComment, getComment } from "@/lib/projectSchema";
import { canAccessProject, canManageProject } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";

async function handleDELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ slug: string; issueId: string; commentId: string }>;
  }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, issueId, commentId } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const isMember = project.members.some((m) => m.userId === session.user.id);
  const canAccess = await canAccessProject(
    session.user.id,
    session.user.role,
    project.id,
    isMember
  );

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await getComment(project.schemaName, commentId);

  if (!comment || comment.issue_id !== issueId) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isAuthor = comment.author_id === session.user.id;
  const canManage =
    isAuthor ||
    (await canManageProject(session.user.id, session.user.role, project.id));

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteComment(project.schemaName, commentId);

  return NextResponse.json({ ok: true });
}

export const DELETE = withApiErrorHandling(handleDELETE);
