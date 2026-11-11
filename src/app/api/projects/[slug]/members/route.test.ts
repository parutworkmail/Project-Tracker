import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  projectFindUnique,
  userFindUnique,
  memberCreate,
  canManageProject,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  memberCreate: vi.fn(),
  canManageProject: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

const { enforceRateLimit } = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/enforceRateLimit", () => ({
  enforceRateLimit,
  MINUTE: 60000,
  HOUR: 3600000,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
    user: { findUnique: userFindUnique },
    projectMember: { create: memberCreate },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

vi.mock("@/lib/permissions", () => ({ canManageProject }));

import { Prisma } from "@/generated/prisma/client";
import { POST } from "./route";

beforeEach(() => {
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
});

function post(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const params = { params: Promise.resolve({ slug: "x" }) };

beforeEach(() => {
  for (const mock of [
    authMock,
    projectFindUnique,
    userFindUnique,
    memberCreate,
    canManageProject,
  ]) {
    mock.mockReset();
  }
  authMock.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
  projectFindUnique.mockResolvedValue({ id: "p1" });
  canManageProject.mockResolvedValue(true);
});

describe("POST /api/projects/[slug]/members", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);

    expect((await POST(post({ username: "bob" }), params)).status).toBe(401);
  });

  it("returns 403 for someone who cannot manage the project", async () => {
    canManageProject.mockResolvedValue(false);

    const response = await POST(post({ username: "bob" }), params);

    expect(response.status).toBe(403);
    expect(memberCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON and for a missing username", async () => {
    expect((await POST(post("{not json"), params)).status).toBe(400);

    const missing = await POST(post({ username: "" }), params);
    expect(missing.status).toBe(400);
    expect(typeof (await missing.json()).error).toBe("string");
  });

  it("returns 404 when the user does not exist", async () => {
    userFindUnique.mockResolvedValue(null);

    expect((await POST(post({ username: "ghost" }), params)).status).toBe(404);
  });

  it("adds the member, trimming the username", async () => {
    userFindUnique.mockResolvedValue({
      id: "u2",
      username: "bob",
      name: null,
      email: null,
    });

    const response = await POST(post({ username: "  bob  " }), params);

    expect(response.status).toBe(201);
    expect(userFindUnique).toHaveBeenCalledWith({ where: { username: "bob" } });
    expect(memberCreate).toHaveBeenCalledWith({
      data: { projectId: "p1", userId: "u2" },
    });
  });

  it("returns 409 when the user is already a member", async () => {
    userFindUnique.mockResolvedValue({ id: "u2", username: "bob" });
    memberCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    expect((await POST(post({ username: "bob" }), params)).status).toBe(409);
  });
});
