import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique, userFindUnique, projectAdminUpsert } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    projectFindUnique: vi.fn(),
    userFindUnique: vi.fn(),
    projectAdminUpsert: vi.fn(),
  }));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
    user: { findUnique: userFindUnique },
    projectAdmin: { upsert: projectAdminUpsert },
  },
}));

import { POST } from "./route";

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/projects/x/admins", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/projects/[slug]/admins", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    userFindUnique.mockReset();
    projectAdminUpsert.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(jsonRequest({ userId: "u2" }), params("x"));

    expect(response.status).toBe(401);
    expect(projectAdminUpsert).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await POST(jsonRequest({ userId: "u2" }), params("x"));

    expect(response.status).toBe(403);
    expect(projectAdminUpsert).not.toHaveBeenCalled();
  });

  it("returns 404 when the project doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await POST(jsonRequest({ userId: "u2" }), params("missing"));

    expect(response.status).toBe(404);
    expect(projectAdminUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid payload", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });

    const response = await POST(jsonRequest({}), params("proj-ab12cd"));

    expect(response.status).toBe(400);
    expect(projectAdminUpsert).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });
    userFindUnique.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ userId: "missing-user" }),
      params("proj-ab12cd")
    );

    expect(response.status).toBe(404);
    expect(projectAdminUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 when the target user is already a SUPER_ADMIN", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });
    userFindUnique.mockResolvedValue({ id: "u2", role: "SUPER_ADMIN" });

    const response = await POST(
      jsonRequest({ userId: "u2" }),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(projectAdminUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 when the target user is a plain USER (not ADMIN)", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });
    userFindUnique.mockResolvedValue({ id: "u2", role: "USER" });

    const response = await POST(
      jsonRequest({ userId: "u2" }),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(projectAdminUpsert).not.toHaveBeenCalled();
  });

  it("assigns an ADMIN-role user as a project admin and returns 201", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });
    userFindUnique.mockResolvedValue({ id: "u2", role: "ADMIN" });
    projectAdminUpsert.mockResolvedValue({});

    const response = await POST(
      jsonRequest({ userId: "u2" }),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ ok: true });
    expect(projectAdminUpsert).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: "p1", userId: "u2" } },
      create: { projectId: "p1", userId: "u2", assignedById: "super-1" },
      update: {},
    });
  });
});
