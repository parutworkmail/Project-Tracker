import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique, updateIssueStatus, canAccessProject } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    projectFindUnique: vi.fn(),
    updateIssueStatus: vi.fn(),
    canAccessProject: vi.fn(),
  }));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
  },
}));

vi.mock("@/lib/projectSchema", () => ({ updateIssueStatus }));

vi.mock("@/lib/permissions", () => ({ canAccessProject }));

import { PATCH } from "./route";

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
    updateIssueStatus.mockReset();
    canAccessProject.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the project doesn't exist", async () => {
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
    expect(updateIssueStatus).not.toHaveBeenCalled();
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
    expect(updateIssueStatus).not.toHaveBeenCalled();
  });

  it("updates the issue status scoped to the project's schema", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    updateIssueStatus.mockResolvedValue({ id: "i1", status: "done" });

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: "i1", status: "done" });
    expect(updateIssueStatus).toHaveBeenCalledWith("proj_abc", "i1", "done");
  });

  it("allows an assigned admin who is not a member to update the issue", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    updateIssueStatus.mockResolvedValue({ id: "i1", status: "done" });

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
