import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isSuperAdmin } from "@/lib/permissions";
import { updateUserSchema } from "@/lib/validation/admin";
import { withApiErrorHandling } from "@/lib/apiError";
import { actor, recordAudit } from "@/lib/audit";
import { enforceRateLimit, HOUR } from "@/lib/enforceRateLimit";

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit({
    scope: "admin-update-user",
    subject: session.user.id,
    limit: 100,
    windowMs: HOUR,
    message: "Too many user updates. Please try again later.",
  });

  if (limited) {
    return limited;
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  if (parsed.data.role !== undefined && userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.username !== undefined) data.username = parsed.data.username;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;

  try {
    const updated = await prisma.user.update({ where: { id: userId }, data });

    const roleChanged = parsed.data.role !== undefined && parsed.data.role !== existing.role;

    await recordAudit({
      ...actor(session.user),
      level: roleChanged ? "WARN" : "INFO",
      category: "user",
      action: roleChanged ? "user.role_changed" : "user.updated",
      message: roleChanged
        ? `Changed role of "${updated.username}" from ${existing.role} to ${updated.role}`
        : `Edited the details of user "${updated.username}"`,
      target: `user:${updated.username}`,
    });

    return NextResponse.json({
      id: updated.id,
      username: updated.username,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(", ")
        : "username or email";

      return NextResponse.json(
        { error: `A user with this ${target} already exists.` },
        { status: 409 }
      );
    }

    throw error;
  }
}

async function handleDELETE(
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

  await recordAudit({
    ...actor(session.user),
    level: "WARN",
    category: "user",
    action: "user.deleted",
    message: `Deleted user "${existing.username}" (${existing.role})`,
    target: `user:${existing.username}`,
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withApiErrorHandling(handlePATCH);
export const DELETE = withApiErrorHandling(handleDELETE);
