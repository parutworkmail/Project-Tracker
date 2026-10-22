import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";

async function handleGET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      admins: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json(
    projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      memberCount: project._count.members,
      admins: project.admins.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
      })),
    }))
  );
}

export const GET = withApiErrorHandling(handleGET);
