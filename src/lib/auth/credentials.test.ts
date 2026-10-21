import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const { userFindUnique, userUpdate, checkRateLimit } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
      update: userUpdate,
    },
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit,
}));

import {
  AccountLockedError,
  RateLimitedError,
  MAX_FAILED_ATTEMPTS,
  authenticateCredentials,
} from "./credentials";

const IP = "127.0.0.1";

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    username: "jane",
    email: null,
    name: "Jane",
    image: null,
    password: "hashed",
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}

describe("authenticateCredentials", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    userUpdate.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  });

  it("returns null for an invalid payload (missing username)", async () => {
    const result = await authenticateCredentials(
      { password: "x" },
      IP
    );

    expect(result).toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when the user doesn't exist", async () => {
    userFindUnique.mockResolvedValue(null);

    const result = await authenticateCredentials(
      { username: "jane", password: "password123" },
      IP
    );

    expect(result).toBeNull();
  });

  it("returns null when the user has no password set", async () => {
    userFindUnique.mockResolvedValue(makeUser({ password: null }));

    const result = await authenticateCredentials(
      { username: "jane", password: "password123" },
      IP
    );

    expect(result).toBeNull();
  });

  it("throws RateLimitedError when the IP has exceeded the login rate limit", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 60_000 });

    await expect(
      authenticateCredentials(
        { username: "jane", password: "password123" },
        IP
      )
    ).rejects.toThrow(RateLimitedError);

    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("throws AccountLockedError immediately when lockedUntil is in the future", async () => {
    userFindUnique.mockResolvedValue(
      makeUser({ lockedUntil: new Date(Date.now() + 60_000) })
    );

    await expect(
      authenticateCredentials(
        { username: "jane", password: "password123" },
        IP
      )
    ).rejects.toThrow(AccountLockedError);

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("does not lock out when lockedUntil is in the past (expired lock)", async () => {
    const hash = await bcrypt.hash("password123", 4);
    userFindUnique.mockResolvedValue(
      makeUser({
        password: hash,
        lockedUntil: new Date(Date.now() - 60_000),
        failedLoginAttempts: 4,
      })
    );
    userUpdate.mockResolvedValue({});

    const result = await authenticateCredentials(
      { username: "jane", password: "password123" },
      IP
    );

    expect(result).toEqual({
      id: "user-1",
      email: null,
      name: "Jane",
      image: null,
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  it("returns null and increments failedLoginAttempts on a wrong password", async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    userFindUnique.mockResolvedValue(
      makeUser({ password: hash, failedLoginAttempts: 1 })
    );
    userUpdate.mockResolvedValue({});

    const result = await authenticateCredentials(
      { username: "jane", password: "wrong-password" },
      IP
    );

    expect(result).toBeNull();
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: 2, lockedUntil: null },
    });
  });

  it(`locks the account after ${MAX_FAILED_ATTEMPTS} failed attempts and resets the counter`, async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    userFindUnique.mockResolvedValue(
      makeUser({
        password: hash,
        failedLoginAttempts: MAX_FAILED_ATTEMPTS - 1,
      })
    );
    userUpdate.mockResolvedValue({});

    await expect(
      authenticateCredentials(
        { username: "jane", password: "wrong-password" },
        IP
      )
    ).rejects.toThrow(AccountLockedError);

    const updateArgs = userUpdate.mock.calls[0][0];
    expect(updateArgs.data.failedLoginAttempts).toBe(0);
    expect(updateArgs.data.lockedUntil).toBeInstanceOf(Date);
    expect(updateArgs.data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it("resets failedLoginAttempts to 0 on a correct password after prior failures", async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    userFindUnique.mockResolvedValue(
      makeUser({ password: hash, failedLoginAttempts: 3 })
    );
    userUpdate.mockResolvedValue({});

    const result = await authenticateCredentials(
      { username: "jane", password: "correct-password" },
      IP
    );

    expect(result).not.toBeNull();
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  it("does not call update on a correct password with a clean history", async () => {
    const hash = await bcrypt.hash("correct-password", 4);
    userFindUnique.mockResolvedValue(makeUser({ password: hash }));

    const result = await authenticateCredentials(
      { username: "jane", password: "correct-password" },
      IP
    );

    expect(result).not.toBeNull();
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
