import { beforeEach, describe, expect, it, vi } from "vitest";

const { userCreate, checkRateLimit } = vi.hoisted(() => ({
  userCreate: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: userCreate,
    },
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit,
  getClientIp: () => "127.0.0.1",
}));

import { Prisma } from "@/generated/prisma/client";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function malformedRequest() {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    body: "{not valid json",
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/signup", () => {
  beforeEach(() => {
    userCreate.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  });

  it("returns 429 with Retry-After when the IP has exceeded the signup rate limit", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });

    const response = await POST(
      jsonRequest({ email: "jane@example.com", password: "password123" })
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(typeof body.error).toBe("string");
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 400 with {error: string} on malformed JSON body", async () => {
    const response = await POST(malformedRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 400 with {error: string} on Zod validation failure", async () => {
    const response = await POST(
      jsonRequest({ email: "not-an-email", password: "short" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("returns 409 with {error: string} when the email already exists (P2002)", async () => {
    userCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    const response = await POST(
      jsonRequest({
        email: "existing@example.com",
        password: "password123",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(typeof body.error).toBe("string");
  });

  it("rethrows non-P2002 errors instead of swallowing them", async () => {
    userCreate.mockRejectedValue(new Error("connection lost"));

    await expect(
      POST(
        jsonRequest({ email: "jane@example.com", password: "password123" })
      )
    ).rejects.toThrow("connection lost");
  });

  it("returns 201 with the created user's public fields on success", async () => {
    userCreate.mockResolvedValue({
      id: "user-1",
      email: "jane@example.com",
      name: "Jane",
      password: "hashed-should-not-leak",
    });

    const response = await POST(
      jsonRequest({
        name: "Jane",
        email: "jane@example.com",
        password: "password123",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      id: "user-1",
      email: "jane@example.com",
      name: "Jane",
    });
    expect(body.password).toBeUndefined();
  });

  it("stores a bcrypt hash, never the plaintext password", async () => {
    userCreate.mockResolvedValue({
      id: "user-1",
      email: "jane@example.com",
      name: null,
    });

    await POST(
      jsonRequest({ email: "jane@example.com", password: "password123" })
    );

    const createArgs = userCreate.mock.calls[0][0];
    expect(createArgs.data.password).not.toBe("password123");
    expect(createArgs.data.password).toMatch(/^\$2[aby]\$/);
  });
});
