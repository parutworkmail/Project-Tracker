import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validation/auth";
import { withApiErrorHandling } from "@/lib/apiError";

async function handlePATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.flatten().fieldErrors.newPassword?.[0] ??
          "Invalid input.",
      },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withApiErrorHandling(handlePATCH);
