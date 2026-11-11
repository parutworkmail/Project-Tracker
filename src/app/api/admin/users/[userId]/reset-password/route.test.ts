import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, userFindUnique, userUpdate, hashMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  hashMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

const { enforceRateLimit } = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/enforceRateLimit", () => ({
  enforceRateLimit,
  MINUTE: 60000,
  HOUR: 3600000,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: userFindUnique, update: userUpdate } },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

vi.mock("bcryptjs", () => ({
  default: { hash: hashMock },
  hash: hashMock,
}));

import { POST } from "./route";

beforeEach(() => {
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
});

function post(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function params(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

beforeEach(() => {
  for (const mock of [authMock, userFindUnique, userUpdate, hashMock]) {
    mock.mockReset();
  }
  authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
  hashMock.mockResolvedValue("hashed-new");
});

describe("POST /api/admin/users/[userId]/reset-password", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);

    expect((await POST(post({ password: "longenough1" }), params("u2"))).status).toBe(401);
  });

  it("returns 403 for non super admins", async () => {
    authMock.mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });

    const response = await POST(post({ password: "longenough1" }), params("u2"));

    expect(response.status).toBe(403);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("refuses to reset your own password here", async () => {
    const response = await POST(post({ password: "longenough1" }), params("super-1"));

    expect(response.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and weak passwords", async () => {
    expect((await POST(post("{nope"), params("u2"))).status).toBe(400);

    const short = await POST(post({ password: "short" }), params("u2"));
    expect(short.status).toBe(400);
    expect(typeof (await short.json()).error).toBe("string");

    const long = await POST(post({ password: "a".repeat(73) }), params("u2"));
    expect(long.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown user", async () => {
    userFindUnique.mockResolvedValue(null);

    expect((await POST(post({ password: "longenough1" }), params("ghost"))).status).toBe(404);
  });

  it("stores a hash, forces a change, and clears the lockout", async () => {
    userFindUnique.mockResolvedValue({ id: "u2" });

    const response = await POST(post({ password: "longenough1" }), params("u2"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(hashMock).toHaveBeenCalledWith("longenough1", 10);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: {
        password: "hashed-new",
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    expect(text).not.toContain("hashed-new");
    expect(text).not.toContain("longenough1");
  });
});
