import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeRawUnsafe, queryRawUnsafe, projectFindMany, userFindMany, ensureProjectSchema } =
  vi.hoisted(() => ({
    executeRawUnsafe: vi.fn(),
    queryRawUnsafe: vi.fn(),
    projectFindMany: vi.fn(),
    userFindMany: vi.fn(),
    ensureProjectSchema: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRawUnsafe: executeRawUnsafe,
    $queryRawUnsafe: queryRawUnsafe,
    project: { findMany: projectFindMany },
    user: { findMany: userFindMany },
  },
}));

vi.mock("@/lib/projectSchema", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/projectSchema")>()),
  ensureProjectSchema,
}));

import {
  countUnread,
  countUnreadAcross,
  countUnreadForIssue,
  createNotifications,
  listNotificationViews,
  listUserProjects,
  markRead,
  markReadAcross,
} from "@/lib/notifications";

const SCHEMA = "proj_0123456789abcdef0123456789abcdef";
const OTHER = "proj_fedcba9876543210fedcba9876543210";

beforeEach(() => {
  executeRawUnsafe.mockReset();
  queryRawUnsafe.mockReset();
  projectFindMany.mockReset();
  userFindMany.mockReset();
  ensureProjectSchema.mockReset();
  ensureProjectSchema.mockResolvedValue(undefined);
  executeRawUnsafe.mockResolvedValue(1);
});

describe("createNotifications", () => {
  it("inserts one row per person with bound values", async () => {
    await createNotifications(SCHEMA, [
      { userId: "u2", kind: "mention", issueId: "i1", actorId: "u1", commentId: "c1" },
      { userId: "u3", kind: "assigned", issueId: "i1", actorId: "u1" },
    ]);

    expect(ensureProjectSchema).toHaveBeenCalledWith(SCHEMA);
    expect(executeRawUnsafe).toHaveBeenCalledTimes(2);

    const [sql, , userId, kind, issueId, commentId, actorId] = executeRawUnsafe.mock.calls[0];
    expect(sql).toContain(`INSERT INTO "${SCHEMA}"."notifications"`);
    expect(sql).not.toContain("u2");
    expect([userId, kind, issueId, commentId, actorId]).toEqual(["u2", "mention", "i1", "c1", "u1"]);
    expect(executeRawUnsafe.mock.calls[1][5]).toBeNull();
  });

  it("never notifies people about their own actions", async () => {
    await createNotifications(SCHEMA, [
      { userId: "u1", kind: "mention", issueId: "i1", actorId: "u1" },
    ]);

    expect(executeRawUnsafe).not.toHaveBeenCalled();
    expect(ensureProjectSchema).not.toHaveBeenCalled();
  });

  it("does nothing for an empty list", async () => {
    await createNotifications(SCHEMA, []);

    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("keeps notifications from a system action with no actor", async () => {
    await createNotifications(SCHEMA, [
      { userId: "u2", kind: "assigned", issueId: "i1", actorId: null },
    ]);

    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("swallows database failures so the caller's action still succeeds", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    executeRawUnsafe.mockRejectedValue(new Error("db down"));

    await expect(
      createNotifications(SCHEMA, [{ userId: "u2", kind: "mention", issueId: "i1", actorId: "u1" }])
    ).resolves.toBeUndefined();

    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it("refuses an invalid schema name without touching the database", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    await createNotifications("public; DROP TABLE x", [
      { userId: "u2", kind: "mention", issueId: "i1", actorId: "u1" },
    ]);

    expect(executeRawUnsafe).not.toHaveBeenCalled();
    quiet.mockRestore();
  });
});

describe("unread counts", () => {
  it("counts only this person's unread rows, bigint safe", async () => {
    queryRawUnsafe.mockResolvedValue([{ count: BigInt(7) }]);

    expect(await countUnread(SCHEMA, "u2")).toBe(7);

    const [sql, userId] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("read_at IS NULL");
    expect(sql).toContain("user_id = $1");
    expect(userId).toBe("u2");
  });

  it("counts for a single task", async () => {
    queryRawUnsafe.mockResolvedValue([{ count: "3" }]);

    expect(await countUnreadForIssue(SCHEMA, "u2", "i1")).toBe(3);
    expect(queryRawUnsafe.mock.calls[0].slice(1)).toEqual(["u2", "i1"]);
  });

  it("is zero when the query returns nothing", async () => {
    queryRawUnsafe.mockResolvedValue([]);

    expect(await countUnread(SCHEMA, "u2")).toBe(0);
  });

  it("adds up projects and treats a broken project as zero", async () => {
    queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes(SCHEMA)) return [{ count: 4 }];
      if (sql.includes(OTHER)) throw new Error("schema gone");
      return [{ count: 2 }];
    });

    const total = await countUnreadAcross(
      [
        { slug: "a", name: "A", schemaName: SCHEMA },
        { slug: "b", name: "B", schemaName: OTHER },
      ],
      "u2"
    );

    expect(total).toBe(4);
  });
});

describe("markRead", () => {
  it("marks everything for the person", async () => {
    executeRawUnsafe.mockResolvedValue(5);

    expect(await markRead(SCHEMA, "u2")).toBe(5);

    const [sql, ...values] = executeRawUnsafe.mock.calls[0];
    expect(sql).toContain("SET read_at = now()");
    expect(sql).toContain("read_at IS NULL");
    expect(sql).not.toContain("issue_id");
    expect(values).toEqual(["u2"]);
  });

  it("can be limited to one task", async () => {
    await markRead(SCHEMA, "u2", "i1");

    const [sql, ...values] = executeRawUnsafe.mock.calls[0];
    expect(sql).toContain("issue_id = $2");
    expect(values).toEqual(["u2", "i1"]);
  });

  it("marks across projects and sums what changed", async () => {
    executeRawUnsafe.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    const updated = await markReadAcross(
      [
        { slug: "a", name: "A", schemaName: SCHEMA },
        { slug: "b", name: "B", schemaName: OTHER },
      ],
      "u2"
    );

    expect(updated).toBe(5);
  });
});

describe("listUserProjects", () => {
  it("asks for projects the person belongs to as member or admin", async () => {
    projectFindMany.mockResolvedValue([{ slug: "a", name: "A", schemaName: SCHEMA }]);

    expect(await listUserProjects("u2")).toHaveLength(1);

    const args = projectFindMany.mock.calls[0][0];
    expect(args.where.OR).toEqual([
      { members: { some: { userId: "u2" } } },
      { admins: { some: { userId: "u2" } } },
    ]);
    expect(args.take).toBe(50);
  });
});

describe("listNotificationViews", () => {
  const projects = [
    { slug: "a", name: "Alpha", schemaName: SCHEMA },
    { slug: "b", name: "Beta", schemaName: OTHER },
  ];

  function row(id: string, minutesAgo: number, extra: Record<string, unknown> = {}) {
    return {
      id,
      kind: "mention",
      issue_id: `issue-${id}`,
      actor_id: "u1",
      read_at: null,
      created_at: new Date(Date.UTC(2026, 0, 1, 12, 0) - minutesAgo * 60_000),
      number: 7,
      title: `Task ${id}`,
      ...extra,
    };
  }

  it("merges projects newest first and names the actor", async () => {
    queryRawUnsafe.mockImplementation(async (sql: string) =>
      sql.includes(SCHEMA) ? [row("old", 30), row("new", 1)] : [row("mid", 10, { kind: "assigned" })]
    );
    userFindMany.mockResolvedValue([{ id: "u1", username: "alice", name: "Alice A" }]);

    const views = await listNotificationViews(projects, "u2");

    expect(views.map((view) => view.id)).toEqual(["new", "mid", "old"]);
    expect(views[0]).toMatchObject({
      kind: "mention",
      projectSlug: "a",
      projectName: "Alpha",
      issueId: "issue-new",
      issueNumber: 7,
      issueTitle: "Task new",
      read: false,
    });
    expect(views[0].actorLabel).toContain("alice");
    expect(views[1]).toMatchObject({ kind: "assigned", projectSlug: "b" });
  });

  it("flags read rows and falls back for missing actors", async () => {
    queryRawUnsafe.mockResolvedValue([
      row("a", 1, { read_at: new Date(), actor_id: null }),
      row("b", 2, { actor_id: "gone" }),
    ]);
    userFindMany.mockResolvedValue([]);

    const views = await listNotificationViews([projects[0]], "u2");

    expect(views[0]).toMatchObject({ read: true, actorLabel: "Someone" });
    expect(views[1]).toMatchObject({ read: false, actorLabel: "A former member" });
  });

  it("caps each project and the total, and skips a broken project", async () => {
    queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes(OTHER)) throw new Error("schema gone");
      return Array.from({ length: 10 }, (_, index) => row(`r${index}`, index));
    });
    userFindMany.mockResolvedValue([]);

    const views = await listNotificationViews(projects, "u2", { perProject: 10, total: 4 });

    expect(views).toHaveLength(4);
    expect(queryRawUnsafe.mock.calls[0][0]).toContain("LIMIT 10");
  });

  it("does not look up users when there is nothing to show", async () => {
    queryRawUnsafe.mockResolvedValue([]);

    expect(await listNotificationViews(projects, "u2")).toEqual([]);
    expect(userFindMany).not.toHaveBeenCalled();
  });
});
