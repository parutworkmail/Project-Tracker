import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createIssue, listIssues } from "@/lib/projectSchema";
import { createIssueSchema } from "@/lib/validation/project";

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

export async function GET(
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

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const issues = await listIssues(project.schemaName);
  return NextResponse.json(issues);
}

export async function POST(
  request: Request,
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

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createIssueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const issue = await createIssue(project.schemaName, {
    title: parsed.data.title,
    description: parsed.data.description || null,
    createdBy: session.user.id,
  });

  return NextResponse.json(issue, { status: 201 });
}
