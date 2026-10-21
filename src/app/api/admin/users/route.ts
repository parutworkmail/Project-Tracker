import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isSuperAdmin } from "@/lib/permissions";
import { createUserSchema } from "@/lib/validation/admin";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.username?.[0] ??
      parsed.error.flatten().fieldErrors.password?.[0] ??
      parsed.error.flatten().fieldErrors.email?.[0] ??
      parsed.error.flatten().formErrors[0] ??
      "Invalid input.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { username, name, email, password, role } = parsed.data;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        name,
        email,
        password: hashedPassword,
        role,
        mustChangePassword: true,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(", ")
        : String(error.meta?.target ?? "field");

      return NextResponse.json(
        { error: `A user with this ${target} already exists.` },
        { status: 409 }
      );
    }

    throw error;
  }
}
