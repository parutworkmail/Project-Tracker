import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique } = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
  },
}));

import { GET } from "./route";

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/projects/[slug]", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectFindUnique.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("x"));

    expect(response.status).toBe(401);
    expect(projectFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the project doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost"),
      params("missing")
    );

    expect(response.status).toBe(404);
  });

  it("reports isMember=false and role=null when the caller isn't a member", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue({
      id: "p1",
      name: "Proj",
      slug: "proj-ab12cd",
      members: [{ userId: "someone-else", role: "OWNER" }],
    });

    const response = await GET(
      new Request("http://localhost"),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isMember).toBe(false);
    expect(body.role).toBeNull();
    expect(body.memberCount).toBe(1);
  });

  it("reports isMember=true and the caller's role when they are a member", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    projectFindUnique.mockResolvedValue({
      id: "p1",
      name: "Proj",
      slug: "proj-ab12cd",
      members: [
        { userId: "user-1", role: "MEMBER" },
        { userId: "someone-else", role: "OWNER" },
      ],
    });

    const response = await GET(
      new Request("http://localhost"),
      params("proj-ab12cd")
    );
    const body = await response.json();

    expect(body.isMember).toBe(true);
    expect(body.role).toBe("MEMBER");
    expect(body.memberCount).toBe(2);
  });
});
