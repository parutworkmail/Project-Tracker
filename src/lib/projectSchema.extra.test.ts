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
  createLabel,
  deleteComment,
  deleteLabel,
  diffIssue,
  ensureProjectSchema,
  generateSchemaName,
  getComment,
  getIssue,
  getProjectStats,
  ISSUES_PAGE_SIZE,
  listComments,
  MAX_LABELS,
  searchIssues,
  setIssueLabels,
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
    ).toBe(6);
  });

  it("skips ALTER when the columns already exist", async () => {
    const schema = generateSchemaName();
    queryRawUnsafe.mockResolvedValue([
      { column_name: "priority" },
      { column_name: "due_date" },
      { column_name: "number" },
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
    expect(queryRawUnsafe.mock.calls[0][0]).not.toMatch(/"issues"\s+WHERE/);
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

  it("orders by every column-header sort with a stable tie-break", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

    const expected: Record<string, string> = {
      title_asc: "lower(title) ASC",
      title_desc: "lower(title) DESC",
      status_asc: "WHEN 'todo' THEN 0",
      status_desc: "WHEN 'done' THEN 0",
      priority_low: "WHEN 'urgent' THEN 3",
      due_desc: "due_date DESC NULLS LAST",
      assignee_asc: "ASC NULLS LAST",
      assignee_desc: "DESC NULLS LAST",
    };

    for (const [sort, fragment] of Object.entries(expected)) {
      queryRawUnsafe.mockClear();
      queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

      await searchIssues(schema, { sort: sort as never });

      const sql = queryRawUnsafe.mock.calls[0][0] as string;
      expect(sql, sort).toContain(fragment);
      expect(sql, sort).toMatch(/ORDER BY[\s\S]*id ASC\s+LIMIT/);
    }
  });

  it("sorts by assignee name with a subquery, not a join", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

    await searchIssues(schema, { sort: "assignee_asc" });

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('FROM "public"."User" u WHERE u.id = issues.assignee_id');
    expect(sql).not.toMatch(/\bJOIN\b.*"User"/);
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

  it("records one activity row per changed field when an actor is given", async () => {
    const schema = await fresh();
    queryRawUnsafe
      .mockResolvedValueOnce([
        {
          id: "i1",
          title: "Old",
          description: null,
          status: "todo",
          priority: "medium",
          due_date: null,
          assignee_id: null,
        },
      ])
      .mockResolvedValueOnce([{ id: "i1" }]);

    await updateIssue(
      schema,
      "i1",
      { title: "Old", status: "done", priority: "high" },
      "actor-1"
    );

    const inserts = executeRawUnsafe.mock.calls.filter((c) =>
      String(c[0]).includes('"activity"')
    );
    expect(inserts).toHaveLength(2);
    expect(inserts.map((c) => c[5])).toEqual(["status", "priority"]);
    expect(inserts.every((c) => c[3] === "actor-1")).toBe(true);
  });

  it("does not record activity when no actor is given or the issue is missing", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ id: "i1" }]);
    await updateIssue(schema, "i1", { status: "done" });

    queryRawUnsafe.mockReset();
    queryRawUnsafe.mockResolvedValue([]);
    await updateIssue(schema, "gone", { status: "done" }, "actor-1");

    expect(
      executeRawUnsafe.mock.calls.some((c) => String(c[0]).includes('"activity"'))
    ).toBe(false);
  });

  it("still succeeds when writing the activity row fails", async () => {
    const schema = await fresh();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRawUnsafe
      .mockResolvedValueOnce([{ id: "i1", status: "todo" }])
      .mockResolvedValueOnce([{ id: "i1" }]);
    executeRawUnsafe.mockRejectedValue(new Error("activity down"));

    await expect(
      updateIssue(schema, "i1", { status: "done" }, "actor-1")
    ).resolves.toEqual({ id: "i1" });

    spy.mockRestore();
  });
});

describe("diffIssue", () => {
  const before = {
    id: "i1",
    number: 1,
    title: "T",
    description: "d",
    status: "todo",
    priority: "medium",
    due_date: "2027-01-01",
    created_by: "u1",
    assignee_id: "u2",
  } as never;

  it("ignores unchanged and omitted fields", () => {
    expect(
      diffIssue(before, { title: "T", status: "todo", dueDate: "2027-01-01" })
    ).toEqual([]);
  });

  it("captures old and new values, including clearing a field", () => {
    expect(diffIssue(before, { dueDate: null, assigneeId: null })).toEqual([
      { kind: "changed", field: "due_date", oldValue: "2027-01-01", newValue: null },
      { kind: "changed", field: "assignee_id", oldValue: "u2", newValue: null },
    ]);
  });

  it("never stores description text", () => {
    expect(diffIssue(before, { description: "secret new text" })).toEqual([
      { kind: "changed", field: "description", oldValue: null, newValue: null },
    ]);
  });

  it("clips very long titles", () => {
    const [change] = diffIssue(before, { title: "x".repeat(500) });
    expect(change.newValue!.length).toBeLessThanOrEqual(201);
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

describe("labels", () => {
  it("filters issues by label with a bound parameter", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

    await searchIssues(schema, { label: "lab-1" });

    const [sql, ...values] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("issue_labels");
    expect(sql).toContain("fl.label_id = $1");
    expect(values).toEqual(["lab-1"]);
  });

  it("creates a label when under the limit", async () => {
    const schema = await fresh();
    queryRawUnsafe
      .mockResolvedValueOnce([{ count: BigInt(2) }])
      .mockResolvedValueOnce([{ id: "l1", name: "Bug", color: "red" }]);

    expect(await createLabel(schema, { name: "Bug", color: "red" })).toEqual({
      label: { id: "l1", name: "Bug", color: "red" },
    });
    expect(queryRawUnsafe.mock.calls[1][0]).toContain("ON CONFLICT DO NOTHING");
  });

  it("refuses to exceed the label limit without inserting", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValueOnce([{ count: MAX_LABELS }]);

    expect(await createLabel(schema, { name: "More", color: "blue" })).toEqual({
      error: "limit",
    });
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("reports a duplicate name as exists", async () => {
    const schema = await fresh();
    queryRawUnsafe
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([]);

    expect(await createLabel(schema, { name: "bug", color: "red" })).toEqual({
      error: "exists",
    });
  });

  it("deletes a label and returns null when it is missing", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValueOnce([{ id: "l1" }]);
    expect(await deleteLabel(schema, "l1")).toEqual({ id: "l1" });

    queryRawUnsafe.mockResolvedValueOnce([]);
    expect(await deleteLabel(schema, "nope")).toBeNull();
  });

  it("returns not_found for a missing issue and unknown_label for a missing label", async () => {
    const schema = await fresh();

    queryRawUnsafe.mockResolvedValueOnce([]);
    expect(await setIssueLabels(schema, "gone", ["l1"], "u1")).toBe("not_found");

    queryRawUnsafe
      .mockResolvedValueOnce([{ id: "i1" }])
      .mockResolvedValueOnce([]);
    expect(await setIssueLabels(schema, "i1", ["ghost"], "u1")).toBe(
      "unknown_label"
    );
    expect(
      executeRawUnsafe.mock.calls.some((c) => String(c[0]).includes('"issue_labels"'))
    ).toBe(false);
  });

  it("adds and removes only the difference and logs each change", async () => {
    const schema = await fresh();
    queryRawUnsafe
      .mockResolvedValueOnce([{ id: "i1" }])
      .mockResolvedValueOnce([
        { id: "keep", name: "Keep" },
        { id: "new", name: "New" },
      ])
      .mockResolvedValueOnce([
        { id: "keep", name: "Keep" },
        { id: "old", name: "Old" },
      ]);

    expect(await setIssueLabels(schema, "i1", ["keep", "new", "keep"], "u1")).toBe("ok");

    const writes = executeRawUnsafe.mock.calls.map((c) => String(c[0]));
    expect(writes.some((s) => s.includes("DELETE FROM") && s.includes("issue_labels"))).toBe(true);
    expect(writes.some((s) => s.includes("INSERT INTO") && s.includes("issue_labels"))).toBe(true);

    const del = executeRawUnsafe.mock.calls.find((c) => String(c[0]).includes("DELETE FROM"));
    expect(del?.[2]).toEqual(["old"]);
    const ins = executeRawUnsafe.mock.calls.find(
      (c) => String(c[0]).includes("INSERT INTO") && String(c[0]).includes("issue_labels")
    );
    expect(ins?.[2]).toEqual(["new"]);

    const activity = executeRawUnsafe.mock.calls.filter((c) =>
      String(c[0]).includes('"activity"')
    );
    expect(activity.map((c) => [c[5], c[6], c[7]])).toEqual([
      ["label", null, "New"],
      ["label", "Old", null],
    ]);
  });

  it("does nothing when the label set is unchanged", async () => {
    const schema = await fresh();
    queryRawUnsafe
      .mockResolvedValueOnce([{ id: "i1" }])
      .mockResolvedValueOnce([{ id: "a", name: "A" }])
      .mockResolvedValueOnce([{ id: "a", name: "A" }]);

    expect(await setIssueLabels(schema, "i1", ["a"], "u1")).toBe("ok");
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });
});

describe("searchIssues page size", () => {
  it("uses a custom page size and clamps it", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ count: 0 }]);

    const board = await searchIssues(schema, { pageSize: 100 });
    expect(board.pageSize).toBe(100);
    expect(queryRawUnsafe.mock.calls[0][0]).toContain("LIMIT 100 OFFSET 0");

    queryRawUnsafe.mockClear();
    const huge = await searchIssues(schema, { pageSize: 99999 });
    expect(huge.pageSize).toBe(200);

    const tiny = await searchIssues(schema, { pageSize: -5 });
    expect(tiny.pageSize).toBe(1);

    const junk = await searchIssues(schema, { pageSize: Number.NaN });
    expect(junk.pageSize).toBe(ISSUES_PAGE_SIZE);
  });
});

describe("getProjectStats", () => {
  it("maps the single aggregate row to numbers (bigint safe)", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([
      { total: BigInt(10), todo: BigInt(4), inProgress: 3, done: "3", overdue: BigInt(2), unassigned: 1 },
    ]);

    expect(await getProjectStats(schema)).toEqual({
      total: 10,
      todo: 4,
      inProgress: 3,
      done: 3,
      overdue: 2,
      unassigned: 1,
    });
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("returns zeros when the query yields nothing", async () => {
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([]);

    expect(await getProjectStats(schema)).toEqual({
      total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, unassigned: 0,
    });
  });
});

describe("listOpenIssuesAssignedTo", () => {
  it("filters by assignee and open status with bound parameters and a cap", async () => {
    const { listOpenIssuesAssignedTo, MY_TASKS_PER_PROJECT } = await import("./projectSchema");
    const schema = await fresh();
    queryRawUnsafe.mockResolvedValue([{ id: "i1" }]);

    expect(await listOpenIssuesAssignedTo(schema, "user-7")).toEqual([{ id: "i1" }]);

    const [sql, ...values] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("assignee_id = $1");
    expect(sql).toContain("status <> 'done'");
    expect(sql).toContain(`LIMIT ${MY_TASKS_PER_PROJECT}`);
    expect(values).toEqual(["user-7"]);
  });

  it("rejects an invalid schema name without querying", async () => {
    const { listOpenIssuesAssignedTo } = await import("./projectSchema");
    await expect(listOpenIssuesAssignedTo("bad", "u")).rejects.toThrow(/Invalid schema name/);
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });
});
