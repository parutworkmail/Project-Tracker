import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectMemberFindMany } = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectMemberFindMany: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectMember: { findMany: projectMemberFindMany },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

import { GET } from "./route";

describe("GET /api/projects", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectMemberFindMany.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(401);
    expect(projectMemberFindMany).not.toHaveBeenCalled();
  });

  it("returns the user's projects, scoped by userId", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectMemberFindMany.mockResolvedValue([
      {
        project: { id: "p1", name: "Proj One", slug: "proj-one-ab12cd" },
      },
    ]);

    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      { id: "p1", name: "Proj One", slug: "proj-one-ab12cd" },
    ]);
    expect(projectMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });
});
