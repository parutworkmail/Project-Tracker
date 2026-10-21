import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isSuperAdmin } from "@/lib/permissions";
import { updateUserRoleSchema } from "@/lib/validation/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = updateUserRoleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: parsed.data.role },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        {
          error:
            "This user still owns one or more projects. Delete or transfer those projects before deleting the user.",
        },
        { status: 409 }
      );
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}
