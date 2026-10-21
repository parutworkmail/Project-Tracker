import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
      }
    );
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

  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.flatten().fieldErrors.email?.[0] ??
      parsed.error.flatten().fieldErrors.password?.[0] ??
      parsed.error.flatten().fieldErrors.name?.[0] ??
      parsed.error.flatten().formErrors[0] ??
      "Invalid input.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    throw error;
  }
}
