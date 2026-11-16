import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  projectFindUnique,
  listComments,
  addComment,
  getIssue,
  canAccessProject,
  getAssignableUsers,
  createNotifications,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  listComments: vi.fn(),
  addComment: vi.fn(),
  getIssue: vi.fn(),
  canAccessProject: vi.fn(),
  getAssignableUsers: vi.fn(),
  createNotifications: vi.fn(),
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
  prisma: { project: { findUnique: projectFindUnique } },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

vi.mock("@/lib/projectSchema", () => ({ listComments, addComment, getIssue }));

vi.mock("@/lib/permissions", () => ({ canAccessProject, getAssignableUsers }));

vi.mock("@/lib/notifications", () => ({ createNotifications }));

import { GET, POST } from "./route";

beforeEach(() => {
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
});

function params(slug: string, issueId: string) {
  return { params: Promise.resolve({ slug, issueId }) };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/projects/x/issues/i1/comments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const project = {
  id: "p1",
  schemaName: "proj_abc",
  members: [{ userId: "user-1" }],
};

beforeEach(() => {
  authMock.mockReset();
  projectFindUnique.mockReset();
  listComments.mockReset();
  addComment.mockReset();
  getIssue.mockReset();
  canAccessProject.mockReset();
  getAssignableUsers.mockReset();
  getAssignableUsers.mockResolvedValue([]);
  createNotifications.mockReset();
  createNotifications.mockResolvedValue(undefined);
});

describe("GET /api/projects/[slug]/issues/[issueId]/comments", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("x", "i1"));

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown project", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("x", "i1"));

    expect(response.status).toBe(404);
  });

  it("returns 403 for someone without access", async () => {
    authMock.mockResolvedValue({ user: { id: "outsider", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(false);

    const response = await GET(new Request("http://localhost"), params("x", "i1"));

    expect(response.status).toBe(403);
    expect(listComments).not.toHaveBeenCalled();
  });

  it("lists comments from the project's schema", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    listComments.mockResolvedValue([{ id: "c1", body: "hi" }]);

    const response = await GET(new Request("http://localhost"), params("x", "i1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "c1", body: "hi" }]);
    expect(listComments).toHaveBeenCalledWith("proj_abc", "i1");
  });
});

describe("POST /api/projects/[slug]/issues/[issueId]/comments", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(jsonRequest({ body: "hi" }), params("x", "i1"));

    expect(response.status).toBe(401);
  });

  it("returns 403 for someone without access", async () => {
    authMock.mockResolvedValue({ user: { id: "outsider", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(false);

    const response = await POST(jsonRequest({ body: "hi" }), params("x", "i1"));

    expect(response.status).toBe(403);
    expect(addComment).not.toHaveBeenCalled();
  });

  it("rejects an empty or whitespace-only comment", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);

    const response = await POST(jsonRequest({ body: "   " }), params("x", "i1"));

    expect(response.status).toBe(400);
    expect(addComment).not.toHaveBeenCalled();
  });

  it("returns 404 when the issue does not exist", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    getIssue.mockResolvedValue(null);

    const response = await POST(jsonRequest({ body: "hi" }), params("x", "gone"));

    expect(response.status).toBe(404);
    expect(addComment).not.toHaveBeenCalled();
  });

  it("creates a trimmed comment attributed to the caller", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(true);
    getIssue.mockResolvedValue({ id: "i1" });
    addComment.mockResolvedValue({ id: "c1", body: "hello" });

    const response = await POST(
      jsonRequest({ body: "  hello  " }),
      params("x", "i1")
    );

    expect(response.status).toBe(201);
    expect(addComment).toHaveBeenCalledWith("proj_abc", {
      issueId: "i1",
      authorId: "user-1",
      body: "hello",
    });
    expect(createNotifications).not.toHaveBeenCalled();
  });

  describe("tags", () => {
    const people = [
      { id: "user-1", username: "alice", name: null },
      { id: "user-2", username: "bob", name: "Bob" },
      { id: "user-3", username: "carol", name: null },
    ];

    function arrange() {
      authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
      projectFindUnique.mockResolvedValue(project);
      canAccessProject.mockResolvedValue(true);
      getIssue.mockResolvedValue({ id: "i1" });
      addComment.mockResolvedValue({ id: "c1", body: "x" });
      getAssignableUsers.mockResolvedValue(people);
    }

    it("notifies each tagged project member once, with the comment id", async () => {
      arrange();

      const response = await POST(
        jsonRequest({ body: "hi @bob and @carol, again @bob" }),
        params("x", "i1")
      );

      expect(response.status).toBe(201);
      expect(getAssignableUsers).toHaveBeenCalledWith("p1");
      expect(createNotifications).toHaveBeenCalledTimes(1);
      expect(createNotifications).toHaveBeenCalledWith("proj_abc", [
        { userId: "user-2", kind: "mention", issueId: "i1", actorId: "user-1", commentId: "c1" },
        { userId: "user-3", kind: "mention", issueId: "i1", actorId: "user-1", commentId: "c1" },
      ]);
    });

    it("ignores names that are not people in the project", async () => {
      arrange();

      await POST(jsonRequest({ body: "hi @stranger" }), params("x", "i1"));

      expect(createNotifications).not.toHaveBeenCalled();
    });

    it("still posts the comment when looking up people fails", async () => {
      arrange();
      getAssignableUsers.mockRejectedValue(new Error("db down"));
      const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await POST(jsonRequest({ body: "hi @bob" }), params("x", "i1"));

      expect(response.status).toBe(201);
      expect(createNotifications).not.toHaveBeenCalled();
      quiet.mockRestore();
    });
  });
});
