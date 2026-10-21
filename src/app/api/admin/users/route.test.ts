import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, userFindMany } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: userFindMany },
  },
}));

import { GET } from "./route";

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    authMock.mockReset();
    userFindMany.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin (ADMIN)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin (USER)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("returns the user list for a SUPER_ADMIN, selecting only public fields", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Jane",
        email: "jane@example.com",
        role: "USER",
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: "user-1",
      name: "Jane",
      email: "jane@example.com",
      role: "USER",
    });
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      })
    );
  });
});
