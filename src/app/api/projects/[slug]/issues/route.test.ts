import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique, listIssues, createIssue, canAccessProject } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    projectFindUnique: vi.fn(),
    listIssues: vi.fn(),
    createIssue: vi.fn(),
    canAccessProject: vi.fn(),
  }));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
  },
}));

vi.mock("@/lib/projectSchema", () => ({
  listIssues,
  createIssue,
}));

vi.mock("@/lib/permissions", () => ({
  canAccessProject,
}));

import { GET, POST } from "./route";

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/projects/x/issues", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const member = { userId: "user-1" };
const project = { id: "p1", schemaName: "proj_abc", members: [member] };

describe("GET /api/projects/[slug]/issues", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    listIssues.mockReset();
    canAccessProject.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the project doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(404);
  });

  it("returns 403 when the caller cannot access the project", async () => {
    authMock.mockResolvedValue({ user: { id: "outsider", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(false);

    const response = await GET(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(403);
    expect(listIssues).not.toHaveBeenCalled();
  });

  it("lists issues scoped to the project's schema for a member", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    listIssues.mockResolvedValue([{ id: "i1", title: "Bug" }]);

    const response = await GET(new Request("http://localhost"), params("x"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "i1", title: "Bug" }]);
    expect(listIssues).toHaveBeenCalledWith("proj_abc");
  });

  it("allows a super admin who is not a member to list issues", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    listIssues.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(200);
    expect(canAccessProject).toHaveBeenCalledWith(
      "super-1",
      "SUPER_ADMIN",
      "p1",
      false
    );
  });
});

describe("POST /api/projects/[slug]/issues", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    createIssue.mockReset();
    canAccessProject.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(jsonRequest({ title: "Bug" }), params("x"));

    expect(response.status).toBe(401);
  });

  it("returns 403 when the caller cannot access the project", async () => {
    authMock.mockResolvedValue({ user: { id: "outsider", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(false);

    const response = await POST(jsonRequest({ title: "Bug" }), params("x"));

    expect(response.status).toBe(403);
    expect(createIssue).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid payload", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);

    const response = await POST(jsonRequest({ title: "" }), params("x"));

    expect(response.status).toBe(400);
    expect(createIssue).not.toHaveBeenCalled();
  });

  it("creates the issue scoped to the project's schema, attributed to the caller", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    createIssue.mockResolvedValue({ id: "i1", title: "Bug" });

    const response = await POST(
      jsonRequest({ title: "Bug", description: "Steps to repro" }),
      params("x")
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ id: "i1", title: "Bug" });
    expect(createIssue).toHaveBeenCalledWith("proj_abc", {
      title: "Bug",
      description: "Steps to repro",
      createdBy: "user-1",
    });
  });

  it("normalizes an empty description to null", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    createIssue.mockResolvedValue({ id: "i1", title: "Bug" });

    await POST(jsonRequest({ title: "Bug", description: "" }), params("x"));

    expect(createIssue).toHaveBeenCalledWith("proj_abc", {
      title: "Bug",
      description: null,
      createdBy: "user-1",
    });
  });
});
