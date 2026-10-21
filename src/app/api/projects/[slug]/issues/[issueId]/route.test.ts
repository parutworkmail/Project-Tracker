import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique, updateIssueStatus } = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  updateIssueStatus: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
  },
}));

vi.mock("@/lib/projectSchema", () => ({ updateIssueStatus }));

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

const member = { userId: "user-1", role: "MEMBER" };
const project = { id: "p1", schemaName: "proj_abc", members: [member] };

describe("PATCH /api/projects/[slug]/issues/[issueId]", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    updateIssueStatus.mockReset();
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
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when the caller is not a project member", async () => {
    authMock.mockResolvedValue({ user: { id: "outsider" } });
    projectFindUnique.mockResolvedValue(project);

    const response = await PATCH(
      jsonRequest({ status: "done" }),
      params("x", "i1")
    );

    expect(response.status).toBe(403);
    expect(updateIssueStatus).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid status", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue(project);

    const response = await PATCH(
      jsonRequest({ status: "archived" }),
      params("x", "i1")
    );

    expect(response.status).toBe(400);
    expect(updateIssueStatus).not.toHaveBeenCalled();
  });

  it("updates the issue status scoped to the project's schema", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue(project);
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
});
