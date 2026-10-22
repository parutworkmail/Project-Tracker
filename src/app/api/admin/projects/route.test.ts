import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindMany } = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindMany: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findMany: projectFindMany },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

import { GET } from "./route";

describe("GET /api/admin/projects", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindMany.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(401);
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(403);
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it("returns projects with memberCount and assigned admins", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    projectFindMany.mockResolvedValue([
      {
        id: "p1",
        name: "Proj One",
        slug: "proj-one-ab12cd",
        _count: { members: 3 },
        admins: [
          {
            user: { id: "admin-1", name: "Alice", email: "alice@example.com" },
          },
        ],
      },
    ]);

    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      {
        id: "p1",
        name: "Proj One",
        slug: "proj-one-ab12cd",
        memberCount: 3,
        admins: [{ id: "admin-1", name: "Alice", email: "alice@example.com" }],
      },
    ]);
  });
});
