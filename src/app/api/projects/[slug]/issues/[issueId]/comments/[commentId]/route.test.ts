import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  projectFindUnique,
  getComment,
  deleteComment,
  canManageProject,
  canAccessProject,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  getComment: vi.fn(),
  deleteComment: vi.fn(),
  canManageProject: vi.fn(),
  canAccessProject: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: { project: { findUnique: projectFindUnique } },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

vi.mock("@/lib/projectSchema", () => ({ getComment, deleteComment }));

vi.mock("@/lib/permissions", () => ({ canManageProject, canAccessProject }));

import { DELETE } from "./route";

function params(commentId: string, issueId = "i1") {
  return { params: Promise.resolve({ slug: "x", issueId, commentId }) };
}

const request = new Request("http://localhost", { method: "DELETE" });
const project = { id: "p1", schemaName: "proj_abc", members: [] };

beforeEach(() => {
  authMock.mockReset();
  projectFindUnique.mockReset();
  getComment.mockReset();
  deleteComment.mockReset();
  canManageProject.mockReset();
  canAccessProject.mockReset();
  canAccessProject.mockResolvedValue(true);
});

describe("DELETE /api/projects/[slug]/issues/[issueId]/comments/[commentId]", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(request, params("c1"));

    expect(response.status).toBe(401);
  });

  it("returns 403 when the caller has no access to the project", async () => {
    authMock.mockResolvedValue({ user: { id: "outsider", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(false);

    const response = await DELETE(request, params("c1"));

    expect(response.status).toBe(403);
    expect(getComment).not.toHaveBeenCalled();
  });

  it("returns 404 when the comment does not exist or belongs to another issue", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    getComment.mockResolvedValue({ id: "c1", issue_id: "other", author_id: "user-1" });

    const response = await DELETE(request, params("c1"));

    expect(response.status).toBe(404);
    expect(deleteComment).not.toHaveBeenCalled();
  });

  it("lets the author delete their own comment", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    getComment.mockResolvedValue({ id: "c1", issue_id: "i1", author_id: "user-1" });

    const response = await DELETE(request, params("c1"));

    expect(response.status).toBe(200);
    expect(deleteComment).toHaveBeenCalledWith("proj_abc", "c1");
    expect(canManageProject).not.toHaveBeenCalled();
  });

  it("forbids a different non-manager from deleting it", async () => {
    authMock.mockResolvedValue({ user: { id: "user-2", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    getComment.mockResolvedValue({ id: "c1", issue_id: "i1", author_id: "user-1" });
    canManageProject.mockResolvedValue(false);

    const response = await DELETE(request, params("c1"));

    expect(response.status).toBe(403);
    expect(deleteComment).not.toHaveBeenCalled();
  });

  it("lets a project manager delete anyone's comment", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    projectFindUnique.mockResolvedValue(project);
    getComment.mockResolvedValue({ id: "c1", issue_id: "i1", author_id: "user-1" });
    canManageProject.mockResolvedValue(true);

    const response = await DELETE(request, params("c1"));

    expect(response.status).toBe(200);
    expect(deleteComment).toHaveBeenCalledWith("proj_abc", "c1");
  });
});
