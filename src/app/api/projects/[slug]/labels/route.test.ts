import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, projectFindUnique, listLabels, createLabel, canAccessProject } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    projectFindUnique: vi.fn(),
    listLabels: vi.fn(),
    createLabel: vi.fn(),
    canAccessProject: vi.fn(),
  }));

const { enforceRateLimit } = vi.hoisted(() => ({ enforceRateLimit: vi.fn() }));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/enforceRateLimit", () => ({
  enforceRateLimit,
  MINUTE: 60000,
  HOUR: 3600000,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { findUnique: projectFindUnique } },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));
vi.mock("@/lib/projectSchema", () => ({ listLabels, createLabel, MAX_LABELS: 30 }));
vi.mock("@/lib/permissions", () => ({ canAccessProject }));

import { GET, POST } from "./route";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/projects/x/labels", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const project = { id: "p1", schemaName: "proj_abc", members: [{ userId: "user-1" }] };

beforeEach(() => {
  authMock.mockReset();
  projectFindUnique.mockReset();
  listLabels.mockReset();
  createLabel.mockReset();
  canAccessProject.mockReset();
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
});

describe("GET /api/projects/[slug]/labels", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET(new Request("http://x"), params("x"))).status).toBe(401);
  });

  it("returns 404 for an unknown project and 403 for a non-member", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(null);
    expect((await GET(new Request("http://x"), params("x"))).status).toBe(404);

    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(false);
    expect((await GET(new Request("http://x"), params("x"))).status).toBe(403);
  });

  it("lists the project's labels", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    listLabels.mockResolvedValue([{ id: "l1", name: "Bug", color: "red" }]);

    const response = await GET(new Request("http://x"), params("x"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "l1", name: "Bug", color: "red" }]);
    expect(listLabels).toHaveBeenCalledWith("proj_abc");
  });
});

describe("POST /api/projects/[slug]/labels", () => {
  function allow() {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
  }

  it("returns 401 without a session and 403 for a non-member", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(jsonRequest({ name: "x" }), params("x"))).status).toBe(401);

    allow();
    canAccessProject.mockResolvedValue(false);
    expect((await POST(jsonRequest({ name: "x" }), params("x"))).status).toBe(403);
    expect(createLabel).not.toHaveBeenCalled();
  });

  it("returns the rate-limit response when throttled", async () => {
    allow();
    enforceRateLimit.mockResolvedValue(new Response("slow", { status: 429 }));
    expect((await POST(jsonRequest({ name: "x" }), params("x"))).status).toBe(429);
  });

  it("returns 400 for invalid JSON and invalid input", async () => {
    allow();
    const bad = new Request("http://x", { method: "POST", body: "{nope" });
    expect((await POST(bad, params("x"))).status).toBe(400);
    expect((await POST(jsonRequest({ name: "  " }), params("x"))).status).toBe(400);
    expect(
      (await POST(jsonRequest({ name: "ok", color: "purple" }), params("x"))).status
    ).toBe(400);
  });

  it("creates a label with a trimmed name and default color", async () => {
    allow();
    createLabel.mockResolvedValue({ label: { id: "l1", name: "Bug", color: "gray" } });

    const response = await POST(jsonRequest({ name: " Bug " }), params("x"));

    expect(response.status).toBe(201);
    expect(createLabel).toHaveBeenCalledWith("proj_abc", { name: "Bug", color: "gray" });
  });

  it("maps duplicate and limit outcomes to 409 with a clear message", async () => {
    allow();
    createLabel.mockResolvedValueOnce({ error: "exists" });
    const dup = await POST(jsonRequest({ name: "Bug" }), params("x"));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toMatch(/already exists/);

    createLabel.mockResolvedValueOnce({ error: "limit" });
    const full = await POST(jsonRequest({ name: "Bug" }), params("x"));
    expect(full.status).toBe(409);
    expect((await full.json()).error).toMatch(/at most 30/);
  });
});
