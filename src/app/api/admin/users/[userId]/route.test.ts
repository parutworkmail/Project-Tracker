import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, userFindUnique, userUpdate } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate },
  },
}));

import { PATCH } from "./route";

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
