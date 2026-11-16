import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createIssue, listIssues, setIssueLabels } from "@/lib/projectSchema";
import { createIssueSchema } from "@/lib/validation/project";
import { canAccessProject, isAssignableUser } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";
import { enforceRateLimit, MINUTE } from "@/lib/enforceRateLimit";
import { createNotifications } from "@/lib/notifications";

async function getMembership(slug: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!project) {
    return { project: null, membership: null };
  }

  const membership = project.members.find((m) => m.userId === userId);
  return { project, membership };
}

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const { project, membership } = await getMembership(slug, session.user.id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const canAccess = await canAccessProject(
    session.user.id,
    session.user.role,
    project.id,
    !!membership
  );

  if (!canAccess) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const issues = await listIssues(project.schemaName);
  return NextResponse.json(issues);
}

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit({
    scope: "issue-create",
    subject: session.user.id,
    limit: 60,
    windowMs: MINUTE,
    message: "You are creating tasks too quickly. Please wait a moment.",
  });

  if (limited) {
    return limited;
  }

  const { slug } = await params;
  const { project, membership } = await getMembership(slug, session.user.id);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

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

  const parsed = createIssueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const assigneeId = parsed.data.assigneeId || null;

  if (assigneeId && !(await isAssignableUser(project.id, assigneeId))) {
    return NextResponse.json(
      { error: "Assignee must be a member of this project." },
      { status: 400 }
    );
  }

  const issue = await createIssue(project.schemaName, {
    title: parsed.data.title,
    description: parsed.data.description || null,
    createdBy: session.user.id,
    priority: parsed.data.priority,
    dueDate: parsed.data.dueDate || null,
    assigneeId,
  });

  if (parsed.data.labelIds?.length) {
    await setIssueLabels(
      project.schemaName,
      issue.id,
      parsed.data.labelIds,
      session.user.id
    );
  }

  if (assigneeId) {
    await createNotifications(project.schemaName, [
      {
        userId: assigneeId,
        kind: "assigned",
        issueId: issue.id,
        actorId: session.user.id,
      },
    ]);
  }

  return NextResponse.json(issue, { status: 201 });
}

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
