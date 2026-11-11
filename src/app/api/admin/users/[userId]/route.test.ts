import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, userFindUnique, userUpdate, userDelete } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userDelete: vi.fn(),
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
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate, delete: userDelete },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

import { Prisma } from "@/generated/prisma/client";
import { PATCH, DELETE } from "./route";

beforeEach(() => {
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/users/x", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function params(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

describe("PATCH /api/admin/users/[userId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    userFindUnique.mockReset();
    userUpdate.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(jsonRequest({ role: "ADMIN" }), params("user-2"));

    expect(response.status).toBe(401);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await PATCH(jsonRequest({ role: "ADMIN" }), params("user-2"));

    expect(response.status).toBe(403);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 and blocks a super admin from changing their own role", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });

    const response = await PATCH(
      jsonRequest({ role: "USER" }),
      params("super-1")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid role value", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });

    const response = await PATCH(
      jsonRequest({ role: "NOT_A_ROLE" }),
      params("user-2")
    );

    expect(response.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindUnique.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest({ role: "ADMIN" }),
      params("missing-user")
    );

    expect(response.status).toBe(404);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("updates the target user's role and returns public fields", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindUnique.mockResolvedValue({ id: "user-2" });
    userUpdate.mockResolvedValue({
      id: "user-2",
      name: "Bob",
      email: "bob@example.com",
      role: "ADMIN",
      password: "hashed-should-not-leak",
    });

    const response = await PATCH(jsonRequest({ role: "ADMIN" }), params("user-2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      id: "user-2",
      name: "Bob",
      email: "bob@example.com",
      role: "ADMIN",
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { role: "ADMIN" },
    });
  });
});

describe("PATCH profile fields /api/admin/users/[userId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    userFindUnique.mockReset();
    userUpdate.mockReset();
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindUnique.mockResolvedValue({ id: "user-2" });
  });

  it("updates username, name and email together and returns the username", async () => {
    userUpdate.mockResolvedValue({
      id: "user-2",
      username: "bob2",
      name: "Bob",
      email: "bob@example.com",
      role: "USER",
    });

    const response = await PATCH(
      jsonRequest({ username: " bob2 ", name: " Bob ", email: "bob@example.com" }),
      params("user-2")
    );

    expect(response.status).toBe(200);
    expect((await response.json()).username).toBe("bob2");
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { username: "bob2", name: "Bob", email: "bob@example.com" },
    });
  });

  it("clears name and email when sent empty or null", async () => {
    userUpdate.mockResolvedValue({ id: "user-2" });

    await PATCH(jsonRequest({ name: "", email: null }), params("user-2"));

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { name: null, email: null },
    });
  });

  it("lets a super admin edit their own profile but not their own role", async () => {
    userUpdate.mockResolvedValue({ id: "super-1" });

    const profile = await PATCH(jsonRequest({ name: "Me" }), params("super-1"));
    const role = await PATCH(jsonRequest({ role: "USER" }), params("super-1"));

    expect(profile.status).toBe(200);
    expect(role.status).toBe(400);
  });

  it("rejects an invalid username, a bad email and an empty body", async () => {
    for (const body of [{ username: "a" }, { username: "bad name!" }, { email: "nope" }, {}]) {
      const response = await PATCH(jsonRequest(body), params("user-2"));
      expect(response.status).toBe(400);
    }
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 409 when the username or email is already taken", async () => {
    userUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["username"] },
      })
    );

    const response = await PATCH(jsonRequest({ username: "taken" }), params("user-2"));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("username");
  });
});

describe("DELETE /api/admin/users/[userId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    userFindUnique.mockReset();
    userDelete.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost"),
      params("user-2")
    );

    expect(response.status).toBe(401);
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await DELETE(
      new Request("http://localhost"),
      params("user-2")
    );

    expect(response.status).toBe(403);
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("returns 400 and blocks a super admin from deleting their own account", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });

    const response = await DELETE(
      new Request("http://localhost"),
      params("super-1")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost"),
      params("missing-user")
    );

    expect(response.status).toBe(404);
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("returns 409 when the user still owns projects (FK restrict, P2003)", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindUnique.mockResolvedValue({ id: "user-2" });
    userDelete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        { code: "P2003", clientVersion: "test" }
      )
    );

    const response = await DELETE(
      new Request("http://localhost"),
      params("user-2")
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(typeof body.error).toBe("string");
  });

  it("returns a clean 500 (not a raw crash) for non-P2003 errors", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindUnique.mockResolvedValue({ id: "user-2" });
    userDelete.mockRejectedValue(new Error("connection lost"));

    const response = await DELETE(
      new Request("http://localhost"),
      params("user-2")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(typeof body.error).toBe("string");
  });

  it("deletes the user and returns ok", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindUnique.mockResolvedValue({ id: "user-2" });
    userDelete.mockResolvedValue({ id: "user-2" });

    const response = await DELETE(
      new Request("http://localhost"),
      params("user-2")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "user-2" } });
  });
});
