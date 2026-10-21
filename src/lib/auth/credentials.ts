import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export class AccountLockedError extends Error {
  constructor() {
    super("AccountLocked");
    this.name = "AccountLockedError";
  }
}

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export async function authenticateCredentials(
  credentials: Record<string, unknown>
): Promise<AuthorizedUser | null> {
  const parsed = loginSchema.safeParse(credentials);

  if (!parsed.success) {
    return null;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.password) {
    return null;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AccountLockedError();
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    const attempts = user.failedLoginAttempts + 1;
    const isNowLocked = attempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: isNowLocked ? 0 : attempts,
        lockedUntil: isNowLocked
          ? new Date(Date.now() + LOCKOUT_DURATION_MS)
          : null,
      },
    });

    if (isNowLocked) {
      throw new AccountLockedError();
    }

    return null;
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}
