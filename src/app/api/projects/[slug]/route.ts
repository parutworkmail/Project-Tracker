import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dropProjectSchema } from "@/lib/projectSchema";
import { updateProjectSchema } from "@/lib/validation/project";
import { canManageProject } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

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

  const canManage = await canManageProject(
    session.user.id,
    session.user.role,
    project.id
  );

  return NextResponse.json({
    id: project.id,
    name: project.name,
    slug: project.slug,
    isMember: !!membership,
    canManage,
    memberCount: project.members.length,
  });
}

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

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

  const body = await request.json();
  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
  });
}

async function handleDELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

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

  await dropProjectSchema(project.schemaName);
  await prisma.project.delete({ where: { id: project.id } });

  return NextResponse.json({ ok: true });
}

export const GET = withApiErrorHandling(handleGET);
export const PATCH = withApiErrorHandling(handlePATCH);
export const DELETE = withApiErrorHandling(handleDELETE);
