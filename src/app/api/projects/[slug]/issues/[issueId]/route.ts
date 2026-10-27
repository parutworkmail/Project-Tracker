import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateIssueStatus, deleteIssue } from "@/lib/projectSchema";
import { updateIssueStatusSchema } from "@/lib/validation/project";
import { canAccessProject, canManageProject } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, issueId } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const membership = project.members.find(
    (m) => m.userId === session.user.id
  );

  const canAccess = await canAccessProject(
    session.user.id,
    session.user.role,
    project.id,
    !!membership
  );

  if (!canAccess) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateIssueStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const issue = await updateIssueStatus(
    project.schemaName,
    issueId,
    parsed.data.status
  );

  return NextResponse.json(issue);
}

export const PATCH = withApiErrorHandling(handlePATCH);

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, issueId } = await params;

  const project = await prisma.project.findUnique({ where: { slug } });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const canManage = await canManageProject(
    session.user.id,
    session.user.role,
    project.id
  );

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteIssue(project.schemaName, issueId);

  return NextResponse.json({ ok: true });
}

export const DELETE = withApiErrorHandling(handleDELETE);
