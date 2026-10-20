import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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

  return NextResponse.json({
    id: project.id,
    name: project.name,
    slug: project.slug,
    isMember: !!membership,
    role: membership?.role ?? null,
    memberCount: project.members.length,
  });
}
