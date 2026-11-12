import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  projectFindUnique,
  updateIssue,
  setIssueLabels,
  deleteIssue,
  canAccessProject,
  canManageProject,
  isAssignableUser,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  updateIssue: vi.fn(),
  setIssueLabels: vi.fn(),
  deleteIssue: vi.fn(),
  canAccessProject: vi.fn(),
  canManageProject: vi.fn(),
  isAssignableUser: vi.fn(),
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
  updateIssue,
  deleteIssue,
  setIssueLabels,
}));

vi.mock("@/lib/permissions", () => ({
  canAccessProject,
  canManageProject,
  isAssignableUser,
}));

import { DELETE, PATCH } from "./route";

beforeEach(() => {
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
});

function params(slug: string, issueId: string) {
  return { params: Promise.resolve({ slug, issueId }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/projects/x/issues/i1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const member = { userId: "user-1" };
const project = { id: "p1", schemaName: "proj_abc", members: [member] };

describe("PATCH /api/projects/[slug]/issues/[issueId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    updateIssue.mockReset();
    canAccessProject.mockReset();
    isAssignableUser.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the project does not exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when the caller cannot access the project", async () => {
    authMock.mockResolvedValue({ user: { id: "outsider", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(false);

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );

    expect(response.status).toBe(403);
    expect(updateIssue).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid status", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);

    const response = await PATCH(
      jsonRequest({ status: "archived" }),
      params("x", "i1")
    );

    expect(response.status).toBe(400);
    expect(updateIssue).not.toHaveBeenCalled();
  });

  it("returns 400 on an empty patch", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);

    const response = await PATCH(jsonRequest({}), params("x", "i1"));

    expect(response.status).toBe(400);
    expect(updateIssue).not.toHaveBeenCalled();
  });

  it("updates the issue status scoped to the project's schema", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    updateIssue.mockResolvedValue({ id: "i1", status: "done" });

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: "i1", status: "done" });
    expect(updateIssue).toHaveBeenCalledWith("proj_abc", "i1", {
      title: undefined,
      description: undefined,
      status: "done",
      priority: undefined,
      dueDate: undefined,
      assigneeId: undefined,
    }, "user-1");
  });

  it("updates title, description, priority and due date together", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    updateIssue.mockResolvedValue({ id: "i1" });

    const response = await PATCH(
      jsonRequest({
        title: "New title",
        description: "More detail",
        priority: "high",
        dueDate: "2027-01-15",
      }),
      params("x", "i1")
    );

    expect(response.status).toBe(200);
    expect(updateIssue).toHaveBeenCalledWith("proj_abc", "i1", {
      title: "New title",
      description: "More detail",
      status: undefined,
      priority: "high",
      dueDate: "2027-01-15",
      assigneeId: undefined,
    }, "user-1");
  });

  it("clears the due date, description and assignee when given empty/null values", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    updateIssue.mockResolvedValue({ id: "i1" });

    const response = await PATCH(
      jsonRequest({ dueDate: "", description: "", assigneeId: null }),
      params("x", "i1")
    );

    expect(response.status).toBe(200);
    expect(isAssignableUser).not.toHaveBeenCalled();
    expect(updateIssue).toHaveBeenCalledWith("proj_abc", "i1", {
      title: undefined,
      description: null,
      status: undefined,
      priority: undefined,
      dueDate: null,
      assigneeId: null,
    }, "user-1");
  });

  it("assigns an issue to a project member", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    isAssignableUser.mockResolvedValue(true);
    updateIssue.mockResolvedValue({ id: "i1" });

    const response = await PATCH(
      jsonRequest({ assigneeId: "user-2" }),
      params("x", "i1")
    );

    expect(response.status).toBe(200);
    expect(isAssignableUser).toHaveBeenCalledWith("p1", "user-2");
  });

  it("rejects assigning to someone outside the project", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    isAssignableUser.mockResolvedValue(false);

    const response = await PATCH(
      jsonRequest({ assigneeId: "stranger" }),
      params("x", "i1")
    );

    expect(response.status).toBe(400);
    expect(updateIssue).not.toHaveBeenCalled();
  });

  it("returns 404 when the issue does not exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    updateIssue.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "missing")
    );

    expect(response.status).toBe(404);
  });

  it("allows an assigned admin who is not a member to update the issue", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    updateIssue.mockResolvedValue({ id: "i1", status: "done" });

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );

    expect(response.status).toBe(200);
    expect(canAccessProject).toHaveBeenCalledWith(
      "admin-1",
      "ADMIN",
      "p1",
      false
    );
  });
});

describe("DELETE /api/projects/[slug]/issues/[issueId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    deleteIssue.mockReset();
    canManageProject.mockReset();
  });

  const request = new Request("http://localhost/api/projects/x/issues/i1", {
    method: "DELETE",
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(request, params("x", "i1"));

    expect(response.status).toBe(401);
  });

  it("returns 403 for a plain member", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canManageProject.mockResolvedValue(false);

    const response = await DELETE(request, params("x", "i1"));

    expect(response.status).toBe(403);
    expect(deleteIssue).not.toHaveBeenCalled();
  });

  it("deletes the issue for someone who can manage the project", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindUnique.mockResolvedValue(project);
    canManageProject.mockResolvedValue(true);

    const response = await DELETE(request, params("x", "i1"));

    expect(response.status).toBe(200);
    expect(deleteIssue).toHaveBeenCalledWith("proj_abc", "i1");
  });
});

describe("PATCH labels", () => {
  function allow() {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    updateIssue.mockResolvedValue({ id: "i1" });
    setIssueLabels.mockReset();
  }

  it("sets labels before updating and attributes the change to the caller", async () => {
    allow();
    setIssueLabels.mockResolvedValue("ok");

    const response = await PATCH(jsonRequest({ labelIds: ["l1", "l2"] }), params("x", "i1"));

    expect(response.status).toBe(200);
    expect(setIssueLabels).toHaveBeenCalledWith("proj_abc", "i1", ["l1", "l2"], "user-1");
    expect(updateIssue).toHaveBeenCalled();
  });

  it("accepts an empty list to clear every label", async () => {
    allow();
    setIssueLabels.mockResolvedValue("ok");

    expect((await PATCH(jsonRequest({ labelIds: [] }), params("x", "i1"))).status).toBe(200);
    expect(setIssueLabels).toHaveBeenCalledWith("proj_abc", "i1", [], "user-1");
  });

  it("returns 400 for an unknown label and does not apply other edits", async () => {
    allow();
    setIssueLabels.mockResolvedValue("unknown_label");

    const response = await PATCH(
      jsonRequest({ title: "New", labelIds: ["ghost"] }),
      params("x", "i1")
    );

    expect(response.status).toBe(400);
    expect(updateIssue).not.toHaveBeenCalled();
  });

  it("returns 404 when the issue does not exist", async () => {
    allow();
    setIssueLabels.mockResolvedValue("not_found");

    expect((await PATCH(jsonRequest({ labelIds: ["l1"] }), params("x", "gone"))).status).toBe(404);
    expect(updateIssue).not.toHaveBeenCalled();
  });

  it("rejects a malformed labelIds payload", async () => {
    allow();

    expect((await PATCH(jsonRequest({ labelIds: "l1" }), params("x", "i1"))).status).toBe(400);
    expect(setIssueLabels).not.toHaveBeenCalled();
  });

  it("does not touch labels when the field is omitted", async () => {
    allow();

    await PATCH(jsonRequest({ status: "done" }), params("x", "i1"));

    expect(setIssueLabels).not.toHaveBeenCalled();
  });
});
