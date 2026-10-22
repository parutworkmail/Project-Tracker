import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectMemberFindMany, projectCreate, provisionProjectSchema, checkRateLimit } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    projectMemberFindMany: vi.fn(),
    projectCreate: vi.fn(),
    provisionProjectSchema: vi.fn(),
    checkRateLimit: vi.fn(),
  }));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectMember: { findMany: projectMemberFindMany },
    project: { create: projectCreate },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit,
}));

vi.mock("@/lib/projectSchema", async () => {
  const actual = await vi.importActual<typeof import("@/lib/projectSchema")>(
    "@/lib/projectSchema"
  );
  return {
    ...actual,
    provisionProjectSchema,
  };
});

import { GET, POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

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

describe("POST /api/projects", () => {
  beforeEach(() => {
    authMock.mockReset();
    projectCreate.mockReset();
    provisionProjectSchema.mockReset();
    provisionProjectSchema.mockResolvedValue(undefined);
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(jsonRequest({ name: "New Project" }));

    expect(response.status).toBe(401);
    expect(provisionProjectSchema).not.toHaveBeenCalled();
    expect(projectCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller is a plain USER (not a super admin)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

    const response = await POST(jsonRequest({ name: "New Project" }));

    expect(response.status).toBe(403);
    expect(provisionProjectSchema).not.toHaveBeenCalled();
    expect(projectCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller is an ADMIN (not a super admin)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await POST(jsonRequest({ name: "New Project" }));

    expect(response.status).toBe(403);
    expect(provisionProjectSchema).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the user has exceeded the create-project rate limit", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 120_000 });

    const response = await POST(jsonRequest({ name: "New Project" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(typeof body.error).toBe("string");
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(provisionProjectSchema).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid payload", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });

    const response = await POST(jsonRequest({ name: "" }));

    expect(response.status).toBe(400);
    expect(provisionProjectSchema).not.toHaveBeenCalled();
  });

  it("provisions a schema, creates the project with the super admin as creator+member, returns 201", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "SUPER_ADMIN" } });
    projectCreate.mockResolvedValue({
      id: "p1",
      name: "New Project",
      slug: "new-project-ab12cd",
    });

    const response = await POST(jsonRequest({ name: "New Project" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: "p1",
      name: "New Project",
      slug: "new-project-ab12cd",
    });
    expect(provisionProjectSchema).toHaveBeenCalledTimes(1);

    const createArgs = projectCreate.mock.calls[0][0];
    expect(createArgs.data.name).toBe("New Project");
    expect(createArgs.data.createdById).toBe("user-1");
    expect(createArgs.data.members.create).toEqual({
      userId: "user-1",
    });
  });
});
