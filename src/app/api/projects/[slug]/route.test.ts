import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";

const {
  authMock,
  projectFindUnique,
  projectUpdate,
  projectDelete,
  canManageProject,
  dropProjectSchema,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  projectUpdate: vi.fn(),
  projectDelete: vi.fn(),
  canManageProject: vi.fn(),
  dropProjectSchema: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: projectFindUnique,
      update: projectUpdate,
      delete: projectDelete,
    },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

vi.mock("@/lib/permissions", () => ({
  canManageProject,
}));

vi.mock("@/lib/projectSchema", () => ({
  dropProjectSchema,
}));

import { GET, PATCH, DELETE } from "./route";

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/projects/[slug]", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    canManageProject.mockReset();
    canManageProject.mockResolvedValue(false);
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(401);
    expect(projectFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the project doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost"),
      params("missing")
    );

    expect(response.status).toBe(404);
  });

  it("reports isMember=false and canManage=false when the caller isn't a member or manager", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue({
      id: "p1",
      name: "Proj",
      slug: "proj-ab12cd",
      members: [{ userId: "someone-else" }],
    });

    const response = await GET(
      new Request("http://localhost"),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isMember).toBe(false);
    expect(body.canManage).toBe(false);
    expect(body.memberCount).toBe(1);
  });

  it("reports isMember=true when the caller is a member", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue({
      id: "p1",
      name: "Proj",
      slug: "proj-ab12cd",
      members: [{ userId: "user-1" }, { userId: "someone-else" }],
    });

    const response = await GET(
      new Request("http://localhost"),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(body.isMember).toBe(true);
    expect(body.memberCount).toBe(2);
  });

  it("reports canManage=true when canManageProject resolves true", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({
      id: "p1",
      name: "Proj",
      slug: "proj-ab12cd",
      members: [],
    });
    canManageProject.mockResolvedValue(true);

    const response = await GET(
      new Request("http://localhost"),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(body.canManage).toBe(true);
  });
});

describe("PATCH /api/projects/[slug]", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    projectUpdate.mockReset();
    canManageProject.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(jsonRequest("PATCH", { name: "New" }), params("x"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the project doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await PATCH(jsonRequest("PATCH", { name: "New" }), params("x"));

    expect(response.status).toBe(404);
  });

  it("returns 403 when the caller cannot manage the project", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue({ id: "p1", slug: "proj-ab12cd" });
    canManageProject.mockResolvedValue(false);

    const response = await PATCH(
      jsonRequest("PATCH", { name: "New" }),
      params("proj-ab12cd")
    );

    expect(response.status).toBe(403);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid payload", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1", slug: "proj-ab12cd" });
    canManageProject.mockResolvedValue(true);

    const response = await PATCH(
      jsonRequest("PATCH", { name: "" }),
      params("proj-ab12cd")
    );

    expect(response.status).toBe(400);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it("renames the project when the caller can manage it", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1", slug: "proj-ab12cd" });
    canManageProject.mockResolvedValue(true);
    projectUpdate.mockResolvedValue({
      id: "p1",
      name: "Renamed",
      slug: "proj-ab12cd",
    });

    const response = await PATCH(
      jsonRequest("PATCH", { name: "Renamed" }),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Renamed");
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { name: "Renamed" },
    });
  });

  it("updates the slug when the caller can manage it", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1", slug: "proj-ab12cd" });
    canManageProject.mockResolvedValue(true);
    projectUpdate.mockResolvedValue({
      id: "p1",
      name: "Proj",
      slug: "new-link",
    });

    const response = await PATCH(
      jsonRequest("PATCH", { slug: "new-link" }),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.slug).toBe("new-link");
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { slug: "new-link" },
    });
  });

  it("returns 409 when the new slug is already taken", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1", slug: "proj-ab12cd" });
    canManageProject.mockResolvedValue(true);
    projectUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    const response = await PATCH(
      jsonRequest("PATCH", { slug: "taken-link" }),
      params("proj-ab12cd")
    );

    expect(response.status).toBe(409);
  });

  it("rejects an invalid slug format", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({ id: "p1", slug: "proj-ab12cd" });
    canManageProject.mockResolvedValue(true);

    const response = await PATCH(
      jsonRequest("PATCH", { slug: "Not Valid!" }),
      params("proj-ab12cd")
    );

    expect(response.status).toBe(400);
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/projects/[slug]", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    projectDelete.mockReset();
    canManageProject.mockReset();
    dropProjectSchema.mockReset();
    dropProjectSchema.mockResolvedValue(undefined);
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(401);
  });

  it("returns 403 when the caller cannot manage the project", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue({
      id: "p1",
      slug: "proj-ab12cd",
      schemaName: "proj_abc",
    });
    canManageProject.mockResolvedValue(false);

    const response = await DELETE(
      new Request("http://localhost"),
      params("proj-ab12cd")
    );

    expect(response.status).toBe(403);
    expect(projectDelete).not.toHaveBeenCalled();
    expect(dropProjectSchema).not.toHaveBeenCalled();
  });

  it("drops the schema and deletes the project when the caller can manage it", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue({
      id: "p1",
      slug: "proj-ab12cd",
      schemaName: "proj_abc",
    });
    canManageProject.mockResolvedValue(true);
    projectDelete.mockResolvedValue({});

    const response = await DELETE(
      new Request("http://localhost"),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(dropProjectSchema).toHaveBeenCalledWith("proj_abc");
    expect(projectDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });
});
