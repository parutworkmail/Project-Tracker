import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/permissions";
import { assignProjectAdminSchema } from "@/lib/validation/admin";
import { withApiErrorHandling } from "@/lib/apiError";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const project = await prisma.project.findUnique({ where: { slug } });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = assignProjectAdminSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Super admins already have full access; assignment is unnecessary." },
      { status: 400 }
    );
  }

  if (targetUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only users with the ADMIN role can be assigned to a project." },
      { status: 400 }
    );
  }

  await prisma.projectAdmin.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: targetUser.id,
      },
    },
    create: {
      projectId: project.id,
      userId: targetUser.id,
      assignedById: session.user.id,
    },
    update: {},
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export const POST = withApiErrorHandling(handlePOST);
