import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateIssue, deleteIssue } from "@/lib/projectSchema";
import { updateIssueSchema } from "@/lib/validation/project";
import {
  canAccessProject,
  canManageProject,
  isAssignableUser,
} from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";
import { enforceRateLimit, MINUTE } from "@/lib/enforceRateLimit";

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; issueId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit({
    scope: "issue-update",
    subject: session.user.id,
    limit: 120,
    windowMs: MINUTE,
    message: "You are updating tasks too quickly. Please wait a moment.",
  });

  if (limited) {
    return limited;
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateIssueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { title, description, status, priority, dueDate, assigneeId } =
    parsed.data;

  const normalizedAssignee =
    assigneeId === undefined ? undefined : assigneeId || null;

  if (
    normalizedAssignee &&
    !(await isAssignableUser(project.id, normalizedAssignee))
  ) {
    return NextResponse.json(
      { error: "Assignee must be a member of this project." },
      { status: 400 }
    );
  }

  const issue = await updateIssue(
    project.schemaName,
    issueId,
    {
      title,
      description: description === undefined ? undefined : description || null,
      status,
      priority,
      dueDate: dueDate === undefined ? undefined : dueDate || null,
      assigneeId: normalizedAssignee,
    },
    session.user.id
  );

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

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
