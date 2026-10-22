import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, userFindUnique, userUpdate, userDelete } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userDelete: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate, delete: userDelete },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

import { Prisma } from "@/generated/prisma/client";
import { PATCH, DELETE } from "./route";

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
