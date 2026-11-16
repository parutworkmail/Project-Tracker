import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { GlobalRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { addComment, getIssue, listComments } from "@/lib/projectSchema";
import { createCommentSchema } from "@/lib/validation/project";
import { canAccessProject, getAssignableUsers } from "@/lib/permissions";
import { findMentionedUsers } from "@/lib/mentions";
import { createNotifications } from "@/lib/notifications";
import { withApiErrorHandling } from "@/lib/apiError";
import { enforceRateLimit, MINUTE } from "@/lib/enforceRateLimit";

type RouteContext = {
  params: Promise<{ slug: string; issueId: string }>;
};

async function resolveAccess(slug: string, userId: string, role: GlobalRole) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!project) {
    return { project: null, allowed: false };
  }

  const isMember = project.members.some((m) => m.userId === userId);
  const allowed = await canAccessProject(userId, role, project.id, isMember);

  return { project, allowed };
}

async function handleGET(_request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, issueId } = await params;
  const { project, allowed } = await resolveAccess(
    slug,
    session.user.id,
    session.user.role
  );

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!allowed) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const comments = await listComments(project.schemaName, issueId);
  return NextResponse.json(comments);
}

async function handlePOST(request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit({
    scope: "comment-create",
    subject: session.user.id,
    limit: 30,
    windowMs: MINUTE,
    message: "You are commenting too quickly. Please wait a moment.",
  });

  if (limited) {
    return limited;
  }

  const { slug, issueId } = await params;
  const { project, allowed } = await resolveAccess(
    slug,
    session.user.id,
    session.user.role
  );

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!allowed) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCommentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid comment" },
      { status: 400 }
    );
  }

  const issue = await getIssue(project.schemaName, issueId);

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const comment = await addComment(project.schemaName, {
    issueId,
    authorId: session.user.id,
    body: parsed.data.body,
  });

  if (!comment) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  try {
    const people = await getAssignableUsers(project.id);
    const mentioned = findMentionedUsers(parsed.data.body, people);

    if (mentioned.length > 0) {
      await createNotifications(
        project.schemaName,
        mentioned.map((user) => ({
          userId: user.id,
          kind: "mention" as const,
          issueId,
          actorId: session.user.id,
          commentId: comment.id,
        }))
      );
    }
  } catch (error) {
    console.error("Could not notify mentioned people", error);
  }

  return NextResponse.json(comment, { status: 201 });
}

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
