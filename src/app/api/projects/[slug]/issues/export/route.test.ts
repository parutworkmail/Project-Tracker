import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  projectFindUnique,
  userFindMany,
  searchIssues,
  canAccessProject,
  enforceRateLimit,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  projectFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  searchIssues: vi.fn(),
  canAccessProject: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/enforceRateLimit", () => ({
  enforceRateLimit,
  MINUTE: 60000,
  HOUR: 3600000,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: projectFindUnique },
    user: { findMany: userFindMany },
  },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));
vi.mock("@/lib/projectSchema", () => ({ searchIssues, MAX_PAGE_SIZE: 200 }));
vi.mock("@/lib/permissions", () => ({ canAccessProject }));

import { GET } from "./route";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const req = (query = "") =>
  new Request(`http://localhost/api/projects/x/issues/export${query}`);

const project = { id: "p1", slug: "my-proj", schemaName: "proj_abc", members: [{ userId: "u1" }] };

function issue(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `i${n}`,
    number: n,
    title: `Task ${n}`,
    description: null,
    status: "todo",
    priority: "medium",
    due_date: null,
    created_by: "u1",
    assignee_id: null,
    created_at: new Date("2026-01-02T03:04:05Z"),
    updated_at: new Date("2026-01-03T03:04:05Z"),
    labels: [],
    ...overrides,
  };
}

beforeEach(() => {
  authMock.mockReset();
  projectFindUnique.mockReset();
  userFindMany.mockReset();
  searchIssues.mockReset();
  canAccessProject.mockReset();
  enforceRateLimit.mockReset();
  enforceRateLimit.mockResolvedValue(null);
  userFindMany.mockResolvedValue([{ id: "u1", username: "ann", name: "Ann" }]);
});

function allow() {
  authMock.mockResolvedValue({ user: { id: "u1", role: "USER" } });
  projectFindUnique.mockResolvedValue(project);
  canAccessProject.mockResolvedValue(true);
}

describe("GET /api/projects/[slug]/issues/export", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET(req(), params("x"))).status).toBe(401);
  });

  it("returns the rate-limit response when throttled", async () => {
    allow();
    enforceRateLimit.mockResolvedValue(new Response("slow", { status: 429 }));
    expect((await GET(req(), params("x"))).status).toBe(429);
    expect(searchIssues).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown project and 403 for a non-member", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    projectFindUnique.mockResolvedValue(null);
    expect((await GET(req(), params("x"))).status).toBe(404);

    projectFindUnique.mockResolvedValue(project);
    canAccessProject.mockResolvedValue(false);
    expect((await GET(req(), params("x"))).status).toBe(403);
    expect(searchIssues).not.toHaveBeenCalled();
  });

  it("streams a CSV attachment with readable names and labels", async () => {
    allow();
    searchIssues.mockResolvedValue({
      issues: [
        issue(1, {
          title: "Fix, the \"thing\"",
          description: "=cmd()",
          status: "in_progress",
          priority: "urgent",
          due_date: "2027-03-01",
          assignee_id: "u1",
          labels: [
            { id: "l1", name: "Bug", color: "red" },
            { id: "l2", name: "UI", color: "teal" },
          ],
        }),
        issue(2, { assignee_id: "ghost" }),
      ],
      total: 2,
      page: 1,
      pageSize: 200,
    });

    const response = await GET(req(), params("x"));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

    expect(response.status).toBe(200);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="my-proj-tasks-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(response.headers.get("X-Export-Truncated")).toBe("false");
    expect(text.startsWith("\uFEFF#,Title,Description")).toBe(true);
    expect(text).toContain('1,"Fix, the ""thing""",\'=cmd(),In progress,Urgent,2027-03-01,Ann (ann),Bug; UI,Ann (ann),');
    expect(text).toContain("Former member");
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(3);
  });

  it("passes the board filters through to the search", async () => {
    allow();
    searchIssues.mockResolvedValue({ issues: [], total: 0, page: 1, pageSize: 200 });

    await GET(
      req("?q=bug&status=done&priority=high&assignee=u9&label=l1&sort=due&view=board&page=4"),
      params("x")
    );

    expect(searchIssues).toHaveBeenCalledWith("proj_abc", {
      q: "bug",
      status: "done",
      priority: "high",
      assignee: "u9",
      label: "l1",
      sort: "due",
      pageSize: 200,
      page: 1,
    });
  });

  it("pages through every result and stops once it has them all", async () => {
    allow();
    const first = Array.from({ length: 200 }, (_, i) => issue(i + 1));
    const second = Array.from({ length: 50 }, (_, i) => issue(i + 201));
    searchIssues
      .mockResolvedValueOnce({ issues: first, total: 250, page: 1, pageSize: 200 })
      .mockResolvedValueOnce({ issues: second, total: 250, page: 2, pageSize: 200 });

    const text = await (await GET(req(), params("x"))).text();

    expect(searchIssues).toHaveBeenCalledTimes(2);
    expect(searchIssues.mock.calls[1][1].page).toBe(2);
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(251);
  });

  it("caps the export at 5000 rows and says it was truncated", async () => {
    allow();
    searchIssues.mockImplementation(async (_schema: string, opts: { page: number }) => ({
      issues: Array.from({ length: 200 }, (_, i) => issue((opts.page - 1) * 200 + i + 1)),
      total: 9000,
      page: opts.page,
      pageSize: 200,
    }));

    const response = await GET(req(), params("x"));
    const text = await response.text();

    expect(searchIssues).toHaveBeenCalledTimes(25);
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(5001);
    expect(response.headers.get("X-Export-Truncated")).toBe("true");
    expect(response.headers.get("X-Export-Total")).toBe("9000");
  });

  it("exports just the header for an empty project", async () => {
    allow();
    searchIssues.mockResolvedValue({ issues: [], total: 0, page: 1, pageSize: 200 });

    const text = await (await GET(req(), params("x"))).text();

    expect(text.split("\r\n").filter(Boolean)).toHaveLength(1);
    expect(userFindMany).not.toHaveBeenCalled();
  });
});
