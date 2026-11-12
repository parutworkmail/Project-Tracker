import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique, deleteLabel, canManageProject } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    projectFindUnique: vi.fn(),
    deleteLabel: vi.fn(),
    canManageProject: vi.fn(),
  })
);

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { findUnique: projectFindUnique } },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));
vi.mock("@/lib/projectSchema", () => ({ deleteLabel }));
vi.mock("@/lib/permissions", () => ({ canManageProject }));

import { DELETE } from "./route";

const params = (slug: string, labelId: string) => ({
  params: Promise.resolve({ slug, labelId }),
});
const project = { id: "p1", schemaName: "proj_abc" };
const request = () => new Request("http://x", { method: "DELETE" });

beforeEach(() => {
  authMock.mockReset();
  projectFindUnique.mockReset();
  deleteLabel.mockReset();
  canManageProject.mockReset();
});

describe("DELETE /api/projects/[slug]/labels/[labelId]", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);
    expect((await DELETE(request(), params("x", "l1"))).status).toBe(401);
  });

  it("returns 404 when the project is missing", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    projectFindUnique.mockResolvedValue(null);
    expect((await DELETE(request(), params("x", "l1"))).status).toBe(404);
  });

  it("returns 403 for someone who cannot manage the project", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canManageProject.mockResolvedValue(false);

    expect((await DELETE(request(), params("x", "l1"))).status).toBe(403);
    expect(deleteLabel).not.toHaveBeenCalled();
  });

  it("returns 404 when the label does not exist", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    projectFindUnique.mockResolvedValue(project);
    canManageProject.mockResolvedValue(true);
    deleteLabel.mockResolvedValue(null);

    expect((await DELETE(request(), params("x", "l1"))).status).toBe(404);
  });

  it("deletes the label for a manager", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    projectFindUnique.mockResolvedValue(project);
    canManageProject.mockResolvedValue(true);
    deleteLabel.mockResolvedValue({ id: "l1" });

    const response = await DELETE(request(), params("x", "l1"));

    expect(response.status).toBe(200);
    expect(deleteLabel).toHaveBeenCalledWith("proj_abc", "l1");
  });
});
