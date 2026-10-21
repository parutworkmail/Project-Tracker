import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique, projectMemberUpsert } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    projectFindUnique: vi.fn(),
    projectMemberUpsert: vi.fn(),
  })
);

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
    projectMember: { upsert: projectMemberUpsert },
  },
}));

import { POST } from "./route";

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("POST /api/projects/[slug]/join", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
    projectMemberUpsert.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(401);
    expect(projectMemberUpsert).not.toHaveBeenCalled();
  });

  it("returns 404 when the project doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(404);
    expect(projectMemberUpsert).not.toHaveBeenCalled();
  });

  it("upserts a MEMBER-role membership for the caller and returns ok", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });
    projectMemberUpsert.mockResolvedValue({});

    const response = await POST(
      new Request("http://localhost"),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(projectMemberUpsert).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: "p1", userId: "user-1" } },
      create: { projectId: "p1", userId: "user-1", role: "MEMBER" },
      update: {},
    });
  });

  it("does not downgrade an existing member's role (empty update payload)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue({ id: "p1" });
    projectMemberUpsert.mockResolvedValue({});

    await POST(new Request("http://localhost"), params("proj-ab12cd"));

    const callArgs = projectMemberUpsert.mock.calls[0][0];
    expect(callArgs.update).toEqual({});
  });
});
