import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, userFindMany, userCreate } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindMany: vi.fn(),
  userCreate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: userFindMany, create: userCreate },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

import { Prisma } from "@/generated/prisma/client";
import { GET, POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    authMock.mockReset();
    userFindMany.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(401);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin (ADMIN)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(403);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin (USER)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(403);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("returns the user list for a SUPER_ADMIN, selecting only public fields", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userFindMany.mockResolvedValue([
      {
        id: "user-1",
        username: "jane",
        name: "Jane",
        email: "jane@example.com",
        role: "USER",
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: "user-1",
      username: "jane",
      name: "Jane",
      email: "jane@example.com",
      role: "USER",
    });
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      })
    );
  });
});

describe("POST /api/admin/users", () => {
  beforeEach(() => {
    authMock.mockReset();
    userCreate.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ username: "jdoe", password: "password123" })
    );

    expect(response.status).toBe(401);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });

    const response = await POST(
      jsonRequest({ username: "jdoe", password: "password123" })
    );

    expect(response.status).toBe(403);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 400 with {error: string} on malformed JSON body", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });

    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: "{not valid json",
        headers: { "Content-Type": "application/json" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid username", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });

    const response = await POST(
      jsonRequest({ username: "a", password: "password123" })
    );

    expect(response.status).toBe(400);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the username or email already exists (P2002)", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["username"] },
      })
    );

    const response = await POST(
      jsonRequest({ username: "existing", password: "password123" })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(typeof body.error).toBe("string");
    expect(body.error).toContain("username");
  });

  it("returns a clean 500 (not a raw crash) for non-P2002 errors", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userCreate.mockRejectedValue(new Error("connection lost"));

    const response = await POST(
      jsonRequest({ username: "jdoe", password: "password123" })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(typeof body.error).toBe("string");
  });

  it("creates the user with mustChangePassword true and a bcrypt hash, returns 201", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userCreate.mockResolvedValue({
      id: "user-2",
      username: "jdoe",
      name: null,
      email: null,
      role: "USER",
      password: "hashed-should-not-leak",
    });

    const response = await POST(
      jsonRequest({ username: "jdoe", password: "password123" })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: "user-2",
      username: "jdoe",
      name: null,
      email: null,
      role: "USER",
    });
    expect(body.password).toBeUndefined();

    const createArgs = userCreate.mock.calls[0][0];
    expect(createArgs.data.mustChangePassword).toBe(true);
    expect(createArgs.data.password).not.toBe("password123");
    expect(createArgs.data.password).toMatch(/^\$2[aby]\$/);
  });

  it("defaults role to USER when not specified", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userCreate.mockResolvedValue({
      id: "user-2",
      username: "jdoe",
      name: null,
      email: null,
      role: "USER",
    });

    await POST(jsonRequest({ username: "jdoe", password: "password123" }));

    const createArgs = userCreate.mock.calls[0][0];
    expect(createArgs.data.role).toBe("USER");
  });

  it("allows an explicit role override", async () => {
    authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
    userCreate.mockResolvedValue({
      id: "user-2",
      username: "jdoe",
      name: null,
      email: null,
      role: "ADMIN",
    });

    await POST(
      jsonRequest({ username: "jdoe", password: "password123", role: "ADMIN" })
    );

    const createArgs = userCreate.mock.calls[0][0];
    expect(createArgs.data.role).toBe("ADMIN");
  });
});
