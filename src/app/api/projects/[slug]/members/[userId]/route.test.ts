import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  projectFindUnique,
  memberFindUnique,
  memberDelete,
  canManageProject,
  unassignUserIssues,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  memberFindUnique: vi.fn(),
  memberDelete: vi.fn(),
  canManageProject: vi.fn(),
  unassignUserIssues: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
    projectMember: { findUnique: memberFindUnique, delete: memberDelete },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

vi.mock("@/lib/permissions", () => ({ canManageProject }));
vi.mock("@/lib/projectSchema", () => ({ unassignUserIssues }));

import { DELETE } from "./route";

const request = new Request("http://localhost", { method: "DELETE" });
const project = { id: "p1", schemaName: "proj_abc" };

function params(userId: string) {
  return { params: Promise.resolve({ slug: "x", userId }) };
}

beforeEach(() => {
  for (const mock of [
    authMock,
    projectFindUnique,
    memberFindUnique,
    memberDelete,
    canManageProject,
    unassignUserIssues,
  ]) {
    mock.mockReset();
  }
  projectFindUnique.mockResolvedValue(project);
});

describe("DELETE /api/projects/[slug]/members/[userId]", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);

    expect((await DELETE(request, params("u2"))).status).toBe(401);
  });

  it("returns 404 for an unknown project", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    projectFindUnique.mockResolvedValue(null);

    expect((await DELETE(request, params("u1"))).status).toBe(404);
  });

  it("forbids a plain member from removing someone else", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    canManageProject.mockResolvedValue(false);

    const response = await DELETE(request, params("u2"));

    expect(response.status).toBe(403);
    expect(memberDelete).not.toHaveBeenCalled();
    expect(unassignUserIssues).not.toHaveBeenCalled();
  });

  it("lets a member leave without needing manage rights", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    memberFindUnique.mockResolvedValue({ id: "m1" });

    const response = await DELETE(request, params("u1"));

    expect(response.status).toBe(200);
    expect(canManageProject).not.toHaveBeenCalled();
    expect(unassignUserIssues).toHaveBeenCalledWith("proj_abc", "u1");
    expect(memberDelete).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: "p1", userId: "u1" } },
    });
  });

  it("tells a non-member trying to leave that they are not a member", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    memberFindUnique.mockResolvedValue(null);

    const response = await DELETE(request, params("u1"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/not a member/i);
    expect(memberDelete).not.toHaveBeenCalled();
  });

  it("lets a manager remove another member and unassigns their issues", async () => {
    authMock.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    canManageProject.mockResolvedValue(true);
    memberFindUnique.mockResolvedValue({ id: "m2" });

    const response = await DELETE(request, params("u2"));

    expect(response.status).toBe(200);
    expect(unassignUserIssues).toHaveBeenCalledWith("proj_abc", "u2");
    expect(memberDelete).toHaveBeenCalled();
  });

  it("returns 404 when a manager removes someone who is not a member", async () => {
    authMock.mockResolvedValue({ user: { id: "admin", role: "SUPER_ADMIN" } });
    canManageProject.mockResolvedValue(true);
    memberFindUnique.mockResolvedValue(null);

    const response = await DELETE(request, params("ghost"));

    expect(response.status).toBe(404);
    expect(memberDelete).not.toHaveBeenCalled();
  });
});
