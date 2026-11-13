import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/permissions";
import { resetPasswordSchema } from "@/lib/validation/admin";
import { withApiErrorHandling } from "@/lib/apiError";
import { actor, recordAudit } from "@/lib/audit";
import { enforceRateLimit, HOUR } from "@/lib/enforceRateLimit";

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit({
    scope: "admin-reset-password",
    subject: session.user.id,
    limit: 20,
    windowMs: HOUR,
    message: "Too many password resets. Please try again later.",
  });

  if (limited) {
    return limited;
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Use the change password page to change your own password." },
      { status: 400 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashed,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await recordAudit({
    ...actor(session.user),
    level: "WARN",
    category: "user",
    action: "user.password_reset",
    message: `Reset the password of user "${existing.username}"`,
    target: `user:${existing.username}`,
  });

  return NextResponse.json({ ok: true });
}

export const POST = withApiErrorHandling(handlePOST);
