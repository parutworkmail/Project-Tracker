import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique, projectAdminDeleteMany } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    projectFindUnique: vi.fn(),
    projectAdminDeleteMany: vi.fn(),
  })
);

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
    projectAdmin: { deleteMany: projectAdminDeleteMany },
  },
}));

import { DELETE } from "./route";

function params(slug: string, userId: string) {
  return { params: Promise.resolve({ slug, userId }) };
}

describe("DELETE /api/admin/projects/[slug]/admins/[userId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    projectAdminDeleteMany.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost"),
      params("x", "u2")
    );

    expect(response.status).toBe(401);
    expect(projectAdminDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await DELETE(
      new Request("http://localhost"),
      params("x", "u2")
    );

    expect(response.status).toBe(403);
    expect(projectAdminDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the project doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost"),
      params("missing", "u2")
    );

    expect(response.status).toBe(404);
    expect(projectAdminDeleteMany).not.toHaveBeenCalled();
  });

  it("removes the admin assignment and returns ok", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });
    projectAdminDeleteMany.mockResolvedValue({ count: 1 });

    const response = await DELETE(
      new Request("http://localhost"),
      params("proj-ab12cd", "u2")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(projectAdminDeleteMany).toHaveBeenCalledWith({
      where: { projectId: "p1", userId: "u2" },
    });
  });

  it("still returns ok when there was no matching assignment to remove", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });
    projectAdminDeleteMany.mockResolvedValue({ count: 0 });

    const response = await DELETE(
      new Request("http://localhost"),
      params("proj-ab12cd", "u2")
    );

    expect(response.status).toBe(200);
  });
});
