import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeRawUnsafe, queryRawUnsafe } = vi.hoisted(() => ({
  executeRawUnsafe: vi.fn(),
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRawUnsafe: executeRawUnsafe,
    $queryRawUnsafe: queryRawUnsafe,
  },
}));

import {
  addComment,
  deleteComment,
  ensureProjectSchema,
  generateSchemaName,
  getComment,
  getIssue,
  ISSUES_PAGE_SIZE,
  listComments,
  searchIssues,
  updateIssue,
} from "./projectSchema";

beforeEach(() => {
  executeRawUnsafe.mockReset();
  queryRawUnsafe.mockReset();
});

async function fresh(): Promise<string> {
  const schema = generateSchemaName();
  await ensureProjectSchema(schema);
  executeRawUnsafe.mockClear();
  queryRawUnsafe.mockReset();
  return schema;
}

describe("ensureProjectSchema", () => {
  it("rejects an invalid schema name without touching the DB", async () => {
    await expect(ensureProjectSchema("bad")).rejects.toThrow(
      /Invalid schema name/
    );
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("upgrades an old schema once, then skips on repeat calls", async () => {
    const schema = generateSchemaName();

    await ensureProjectSchema(schema);
    const firstRunCalls = executeRawUnsafe.mock.calls.length;
    await ensureProjectSchema(schema);

    expect(firstRunCalls).toBeGreaterThan(0);
    expect(executeRawUnsafe).toHaveBeenCalledTimes(firstRunCalls);
  });

  it("retries once when the first attempt fails", async () => {
    const schema = generateSchemaName();
    executeRawUnsafe.mockRejectedValueOnce(new Error("already exists"));

    await expect(ensureProjectSchema(schema)).resolves.toBeUndefined();
  });

  it("shares one run between concurrent callers", async () => {
    const schema = generateSchemaName();

    await Promise.all([
      ensureProjectSchema(schema),
      ensureProjectSchema(schema),
      ensureProjectSchema(schema),
    ]);
    const calls = executeRawUnsafe.mock.calls.length;
    await ensureProjectSchema(schema);

    expect(executeRawUnsafe.mock.calls.length).toBe(calls);
    expect(
      executeRawUnsafe.mock.calls.filter((c) =>
        String(c[0]).includes("CREATE TABLE IF NOT EXISTS")
      ).length
    ).toBe(2);
  });

  it("skips ALTER when the columns already exist", async () => {
    const schema = generateSchemaName();
    queryRawUnsafe.mockResolvedValue([
      { column_name: "priority" },
      { column_name: "due_date" },
    ]);

    await ensureProjectSchema(schema);

    expect(
      executeRawUnsafe.mock.calls.some((c) => String(c[0]).includes("ALTER TABLE"))
    ).toBe(false);
  });

  it("does not memoize a failed upgrade", async () => {
    const schema = generateSchemaName();
    executeRawUnsafe.mockRejectedValue(new Error("boom"));

    await expect(ensureProjectSchema(schema)).rejects.toThrow("boom");
    executeRawUnsafe.mockResolvedValue(undefined);
    await ensureProjectSchema(schema);

    expect(executeRawUnsafe.mock.calls.length).toBeGreaterThan(1);
  });
});

describe("searchIssues", () => {
  it("applies no WHERE clause with no filters and returns the total", async () => {
    const schema = await fresh();
    queryRawUnsafe
      .mockResolvedValueOnce([{ id: "i1" }])
      .mockResolvedValueOnce([{ count: BigInt(42) }]);

    const result = await searchIssues(schema);

    expect(result).toEqual({
      issues: [{ id: "i1" }],
      total: 42,
      page: 1,
      pageSize: ISSUES_PAGE_SIZE,
    });
    expect(queryRawUnsafe.mock.calls[0][0]).not.toContain("WHERE");
    expect(queryRawUnsafe.mock.calls[0][0]).toContain("ORDER BY created_at DESC");
  });

  it("parameterizes every filter and escapes LIKE wildcards in the search term", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

    await searchIssues(schema, {
      q: "50%_off",
      status: "todo",
      priority: "high",
      assignee: "user-9",
    });

    const [sql, ...values] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("ILIKE $1");
    expect(sql).toContain("status = $2");
    expect(sql).toContain("priority = $3");
    expect(sql).toContain("assignee_id = $4");
    expect(values).toEqual(["%50\\%\\_off%", "todo", "high", "user-9"]);
    expect(sql).not.toContain("50%_off");
  });

  it("filters unassigned issues without a bound value", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

    await searchIssues(schema, { assignee: "unassigned" });

    const [sql, ...values] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("assignee_id IS NULL");
    expect(values).toEqual([]);
  });

  it("paginates with LIMIT/OFFSET and never trusts a bad sort key", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

    await searchIssues(schema, {
      page: 3,
      sort: "; DROP TABLE x" as never,
    });

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain(`LIMIT ${ISSUES_PAGE_SIZE} OFFSET ${ISSUES_PAGE_SIZE * 2}`);
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(sql).not.toContain("DROP");
  });

  it("supports the priority and due-date sorts", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

    await searchIssues(schema, { sort: "priority" });
    await searchIssues(schema, { sort: "due" });

    expect(queryRawUnsafe.mock.calls[0][0]).toContain("WHEN 'urgent' THEN 0");
    expect(
      queryRawUnsafe.mock.calls.some((c) =>
        String(c[0]).includes("due_date ASC NULLS LAST")
      )
    ).toBe(true);
  });
});

describe("updateIssue", () => {
  it("builds a SET clause for only the provided fields", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ id: "i1" }]);

    await updateIssue(schema, "i1", {
      title: "T",
      dueDate: "2027-01-01",
      assigneeId: null,
    });

    const [sql, ...values] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("title = $1");
    expect(sql).toContain("due_date = $2::date");
    expect(sql).toContain("assignee_id = $3");
    expect(sql).toContain("WHERE id = $4");
    expect(values).toEqual(["T", "2027-01-01", null, "i1"]);
  });

  it("returns null when no row matched", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([]);

    expect(await updateIssue(schema, "gone", { status: "done" })).toBeNull();
  });

  it("falls back to a read when the patch is empty", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ id: "i1" }]);

    const result = await updateIssue(schema, "i1", {});

    expect(result).toEqual({ id: "i1" });
    expect(queryRawUnsafe.mock.calls[0][0]).toContain("SELECT");
  });
});

describe("getIssue", () => {
  it("returns null when missing", async () => {
    queryRawUnsafe.mockResolvedValue([]);
    expect(await getIssue(generateSchemaName(), "nope")).toBeNull();
  });
});

describe("comments", () => {
  it("lists a single issue's comments oldest first", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([]);

    await listComments(schema, "i1");

    expect(queryRawUnsafe.mock.calls[0][0]).toContain("ORDER BY created_at ASC");
    expect(queryRawUnsafe.mock.calls[0][1]).toBe("i1");
  });

  it("inserts only when the issue exists", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([]);

    const result = await addComment(schema, {
      issueId: "gone",
      authorId: "u1",
      body: "hi",
    });

    expect(result).toBeNull();
    expect(queryRawUnsafe.mock.calls[0][0]).toContain("INSERT INTO");
    expect(queryRawUnsafe.mock.calls[0][0]).toContain("WHERE i.id = $2");
  });

  it("returns the created comment", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ id: "c1" }]);

    expect(
      await addComment(schema, { issueId: "i1", authorId: "u1", body: "hi" })
    ).toEqual({ id: "c1" });
  });

  it("gets and deletes by id", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ id: "c1" }]);

    expect(await getComment(schema, "c1")).toEqual({ id: "c1" });
    await deleteComment(schema, "c1");

    expect(executeRawUnsafe).toHaveBeenLastCalledWith(
      expect.stringContaining("DELETE FROM"),
      "c1"
    );
  });
});
