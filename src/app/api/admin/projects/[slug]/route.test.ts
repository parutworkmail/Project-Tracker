import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  projectFindUnique,
  projectDelete,
  dropProjectSchema,
  enforceRateLimit,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  projectDelete: vi.fn(),
  dropProjectSchema: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/enforceRateLimit", () => ({
  enforceRateLimit,
  MINUTE: 60000,
  HOUR: 3600000,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { findUnique: projectFindUnique, delete: projectDelete } },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));
vi.mock("@/lib/projectSchema", () => ({ dropProjectSchema }));

import { DELETE } from "./route";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

function request(body: unknown) {
  return new Request("http://localhost/api/admin/projects/x", {
    method: "DELETE",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const project = { id: "p1", name: "Website Redesign", slug: "website-redesign", schemaName: "proj_abc" };

beforeEach(() => {
  authMock.mockReset();
  projectFindUnique.mockReset();
  projectDelete.mockReset();
  dropProjectSchema.mockReset();
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
  authMock.mockResolvedValue({ user: { id: "super-1", role: "SUPER_ADMIN" } });
  projectFindUnique.mockResolvedValue(project);
});

describe("DELETE /api/admin/projects/[slug]", () => {
  it("returns 401 without a session and 403 for anyone but a super admin", async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await DELETE(request({ confirmName: project.name }), params("x"))).status).toBe(401);

    authMock.mockResolvedValueOnce({ user: { id: "u1", role: "ADMIN" } });
    expect((await DELETE(request({ confirmName: project.name }), params("x"))).status).toBe(403);

    expect(projectDelete).not.toHaveBeenCalled();
    expect(dropProjectSchema).not.toHaveBeenCalled();
  });

  it("returns the rate-limit response when throttled", async () => {
    enforceRateLimit.mockResolvedValue(new Response("slow", { status: 429 }));

    expect((await DELETE(request({ confirmName: project.name }), params("x"))).status).toBe(429);
    expect(projectDelete).not.toHaveBeenCalled();
  });

  it("rejects a bad body or a missing / empty name before touching anything", async () => {
    expect((await DELETE(request("{nope"), params("x"))).status).toBe(400);
    expect((await DELETE(request({}), params("x"))).status).toBe(400);
    expect((await DELETE(request({ confirmName: "   " }), params("x"))).status).toBe(400);
    expect((await DELETE(request({ confirmName: 42 }), params("x"))).status).toBe(400);

    expect(projectFindUnique).not.toHaveBeenCalled();
    expect(projectDelete).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist", async () => {
    projectFindUnique.mockResolvedValue(null);

    expect((await DELETE(request({ confirmName: "Anything" }), params("gone"))).status).toBe(404);
    expect(projectDelete).not.toHaveBeenCalled();
  });

  it("refuses a wrong name, including a different case, and deletes nothing", async () => {
    for (const wrong of ["website redesign", "Website", "Website Redesign 2", "WEBSITE REDESIGN"]) {
      const response = await DELETE(request({ confirmName: wrong }), params("x"));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/does not match/);
    }

    expect(projectDelete).not.toHaveBeenCalled();
    expect(dropProjectSchema).not.toHaveBeenCalled();
  });

  it("deletes the project row then its schema when the exact name is typed", async () => {
    const order: string[] = [];
    projectDelete.mockImplementation(async () => void order.push("row"));
    dropProjectSchema.mockImplementation(async () => void order.push("schema"));

    const response = await DELETE(request({ confirmName: "Website Redesign" }), params("website-redesign"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(projectDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(dropProjectSchema).toHaveBeenCalledWith("proj_abc");
    expect(order).toEqual(["row", "schema"]);
  });

  it("ignores spaces around the typed name", async () => {
    const response = await DELETE(request({ confirmName: "  Website Redesign  " }), params("x"));

    expect(response.status).toBe(200);
    expect(projectDelete).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when only dropping the schema fails, and logs it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    dropProjectSchema.mockRejectedValue(new Error("lock timeout"));

    const response = await DELETE(request({ confirmName: project.name }), params("x"));

    expect(response.status).toBe(200);
    expect(projectDelete).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not drop the schema when deleting the row fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    projectDelete.mockRejectedValue(new Error("fk violation"));

    const response = await DELETE(request({ confirmName: project.name }), params("x"));

    expect(response.status).toBe(500);
    expect(dropProjectSchema).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
