import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, userUpdate } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: userUpdate },
  },
}));

import { PATCH } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/account/password", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function malformedRequest() {
  return new Request("http://localhost/api/account/password", {
    method: "PATCH",
    body: "{not valid json",
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/account/password", () => {
  beforeEach(() => {
    authMock.mockReset();
    userUpdate.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(jsonRequest({ newPassword: "password123" }));

    expect(response.status).toBe(401);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 with {error: string} on malformed JSON body", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await PATCH(malformedRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 on a password shorter than 8 characters", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });

    const response = await PATCH(jsonRequest({ newPassword: "short1" }));

    expect(response.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("updates the caller's own password and clears mustChangePassword", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    userUpdate.mockResolvedValue({});

    const response = await PATCH(jsonRequest({ newPassword: "newpassword123" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });

    const updateArgs = userUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "user-1" });
    expect(updateArgs.data.mustChangePassword).toBe(false);
    expect(updateArgs.data.password).not.toBe("newpassword123");
    expect(updateArgs.data.password).toMatch(/^\$2[aby]\$/);
  });

  it("always targets the session user's own id, ignoring any id in the body", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    userUpdate.mockResolvedValue({});

    await PATCH(
      jsonRequest({ newPassword: "newpassword123", id: "someone-else" })
    );

    const updateArgs = userUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "user-1" });
  });
});
