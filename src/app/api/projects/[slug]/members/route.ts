import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { addProjectMemberSchema } from "@/lib/validation/project";
import { canManageProject } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";

async function handlePOST(
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
  const parsed = addProjectMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: targetUser.id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This user is already a member of the project." },
        { status: 409 }
      );
    }

    throw error;
  }

  return NextResponse.json(
    {
      id: targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      email: targetUser.email,
    },
    { status: 201 }
  );
}

export const POST = withApiErrorHandling(handlePOST);
