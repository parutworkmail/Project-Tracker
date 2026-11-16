import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  projectFindUnique,
  listIssues,
  createIssue,
  canAccessProject,
  isAssignableUser,
  createNotifications,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  listIssues: vi.fn(),
  createIssue: vi.fn(),
  canAccessProject: vi.fn(),
  isAssignableUser: vi.fn(),
  createNotifications: vi.fn(),
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
    project: { findUnique: projectFindUnique },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

vi.mock("@/lib/projectSchema", () => ({
  listIssues,
  createIssue,
}));

vi.mock("@/lib/permissions", () => ({
  canAccessProject,
  isAssignableUser,
}));

vi.mock("@/lib/notifications", () => ({ createNotifications }));

import { GET, POST } from "./route";

beforeEach(() => {
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
  createNotifications.mockReset();
  createNotifications.mockResolvedValue(undefined);
});

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

  it("returns 404 when the project does not exist", async () => {
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

  it("lists issues scoped to the project schema for a member", async () => {
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
    isAssignableUser.mockReset();
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

  it("creates the issue scoped to the project schema, attributed to the caller", async () => {
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
      priority: undefined,
      dueDate: null,
      assigneeId: null,
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
      priority: undefined,
      dueDate: null,
      assigneeId: null,
    });
  });

  it("passes priority, due date and a valid assignee through", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    isAssignableUser.mockResolvedValue(true);
    createIssue.mockResolvedValue({ id: "i1" });

    const response = await POST(
      jsonRequest({
        title: "Bug",
        priority: "urgent",
        dueDate: "2027-03-01",
        assigneeId: "user-2",
      }),
      params("x")
    );

    expect(response.status).toBe(201);
    expect(isAssignableUser).toHaveBeenCalledWith("p1", "user-2");
    expect(createIssue).toHaveBeenCalledWith("proj_abc", {
      title: "Bug",
      description: null,
      createdBy: "user-1",
      priority: "urgent",
      dueDate: "2027-03-01",
      assigneeId: "user-2",
    });
    expect(createNotifications).toHaveBeenCalledWith("proj_abc", [
      { userId: "user-2", kind: "assigned", issueId: "i1", actorId: "user-1" },
    ]);
  });

  it("does not notify anyone when the task is created without an assignee", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    createIssue.mockResolvedValue({ id: "i1" });

    const response = await POST(jsonRequest({ title: "Bug" }), params("x"));

    expect(response.status).toBe(201);
    expect(createNotifications).not.toHaveBeenCalled();
  });

  it("rejects an assignee who is not part of the project", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    isAssignableUser.mockResolvedValue(false);

    const response = await POST(
      jsonRequest({ title: "Bug", assigneeId: "stranger" }),
      params("x")
    );

    expect(response.status).toBe(400);
    expect(createIssue).not.toHaveBeenCalled();
  });

  it("rejects an invalid priority and an impossible due date", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);

    const badPriority = await POST(
      jsonRequest({ title: "Bug", priority: "asap" }),
      params("x")
    );
    const badDate = await POST(
      jsonRequest({ title: "Bug", dueDate: "2027-02-31" }),
      params("x")
    );

    expect(badPriority.status).toBe(400);
    expect(badDate.status).toBe(400);
    expect(createIssue).not.toHaveBeenCalled();
  });
});

