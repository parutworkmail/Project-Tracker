import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addComment,
  createIssue,
  deleteComment,
  deleteIssue,
  dropProjectSchema,
  generateSchemaName,
  getIssue,
  listActivity,
  listComments,
  provisionProjectSchema,
  searchIssues,
  updateIssue,
} from "./projectSchema";
import { prisma } from "./prisma";

// Runs against the real database in a throwaway schema.
// Enable with: RUN_DB_INTEGRATION=1 node --env-file=.env node_modules/vitest/vitest.mjs run <this file>
const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("project schema (real database)", { timeout: 90_000 }, () => {
  const schema = generateSchemaName();

  beforeAll(async () => {
    await provisionProjectSchema(schema);
  });

  afterAll(async () => {
    await dropProjectSchema(schema);
    await prisma.$disconnect();
  });

  it("creates issues with defaults and returns due_date as a plain string", async () => {
    const issue = await createIssue(schema, { title: "First", createdBy: "u1" });

    expect(issue.priority).toBe("medium");
    expect(issue.due_date).toBeNull();
    expect(issue.status).toBe("todo");

    const dated = await createIssue(schema, {
      title: "Dated",
      createdBy: "u1",
      priority: "urgent",
      dueDate: "2027-03-01",
      assigneeId: "u2",
    });

    expect(dated.due_date).toBe("2027-03-01");
    expect(dated.priority).toBe("urgent");
    expect(dated.assignee_id).toBe("u2");
  });

  it("upgrades a legacy schema that lacks the new columns and comments table", async () => {
    const legacy = generateSchemaName();
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${legacy}"`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${legacy}"."issues" (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
        status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
        created_by TEXT NOT NULL, assignee_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${legacy}"."issues" (id, title, created_by) VALUES ('old1', 'Old task', 'u1')`
    );

    try {
      const { issues, total } = await searchIssues(legacy);
      expect(total).toBe(1);
      expect(issues[0].priority).toBe("medium");
      expect(issues[0].due_date).toBeNull();

      const comment = await addComment(legacy, {
        issueId: "old1",
        authorId: "u1",
        body: "works",
      });
      expect(comment?.body).toBe("works");
    } finally {
      await dropProjectSchema(legacy);
    }
  });

  it("filters, searches (escaping wildcards), sorts and paginates", async () => {
    await createIssue(schema, { title: "100% done", createdBy: "u1", priority: "low" });
    await createIssue(schema, { title: "Plain", description: "has_underscore", createdBy: "u1", priority: "high" });

    const percent = await searchIssues(schema, { q: "100%" });
    expect(percent.issues.map((i) => i.title)).toEqual(["100% done"]);

    const underscore = await searchIssues(schema, { q: "has_under" });
    expect(underscore.total).toBe(1);

    const literalUnderscoreOnly = await searchIssues(schema, { q: "_" });
    expect(literalUnderscoreOnly.total).toBe(1);

    const byPriority = await searchIssues(schema, { sort: "priority" });
    expect(byPriority.issues[0].priority).toBe("urgent");

    const byDue = await searchIssues(schema, { sort: "due" });
    expect(byDue.issues[0].title).toBe("Dated");

    const unassigned = await searchIssues(schema, { assignee: "unassigned" });
    expect(unassigned.issues.every((i) => i.assignee_id === null)).toBe(true);

    const assignedToU2 = await searchIssues(schema, { assignee: "u2" });
    expect(assignedToU2.total).toBe(1);

    const farPage = await searchIssues(schema, { page: 99 });
    expect(farPage.issues).toEqual([]);
    expect(farPage.total).toBeGreaterThan(0);

    const weirdSort = await searchIssues(schema, { sort: "constructor" as never });
    expect(weirdSort.total).toBe(weirdSort.issues.length);
  });

  it("updates fields, clears nullable ones, and reports missing issues", async () => {
    const created = await createIssue(schema, {
      title: "To edit",
      createdBy: "u1",
      dueDate: "2027-05-05",
      assigneeId: "u3",
    });

    const edited = await updateIssue(schema, created.id, {
      title: "Edited",
      status: "in_progress",
      dueDate: null,
      assigneeId: null,
      description: "now with detail",
    });

    expect(edited).toMatchObject({
      title: "Edited",
      status: "in_progress",
      due_date: null,
      assignee_id: null,
      description: "now with detail",
    });
    expect(edited!.updated_at.getTime()).toBeGreaterThanOrEqual(
      created.updated_at.getTime()
    );

    expect(await updateIssue(schema, "missing", { title: "x" })).toBeNull();
    expect(await getIssue(schema, "missing")).toBeNull();
  });

  it("rejects values the database constraints forbid", async () => {
    const issue = await createIssue(schema, { title: "Constrained", createdBy: "u1" });

    await expect(
      updateIssue(schema, issue.id, { priority: "asap" as never })
    ).rejects.toThrow();
  });

  it("stores comments, cascades on issue delete, and refuses orphans", async () => {
    const issue = await createIssue(schema, { title: "Discuss", createdBy: "u1" });

    const first = await addComment(schema, { issueId: issue.id, authorId: "u1", body: "one" });
    await addComment(schema, { issueId: issue.id, authorId: "u2", body: "two" });

    expect((await listComments(schema, issue.id)).map((c) => c.body)).toEqual(["one", "two"]);

    await deleteComment(schema, first!.id);
    expect(await listComments(schema, issue.id)).toHaveLength(1);

    expect(
      await addComment(schema, { issueId: "ghost", authorId: "u1", body: "x" })
    ).toBeNull();

    await deleteIssue(schema, issue.id);
    expect(await listComments(schema, issue.id)).toEqual([]);
  });

  it("numbers issues sequentially and never reuses a deleted number", async () => {
    const a = await createIssue(schema, { title: "Num A", createdBy: "u1" });
    const b = await createIssue(schema, { title: "Num B", createdBy: "u1" });
    expect(b.number).toBe(a.number + 1);

    await deleteIssue(schema, b.id);
    const c = await createIssue(schema, { title: "Num C", createdBy: "u1" });
    expect(c.number).toBeGreaterThan(b.number);
  });

  it("records an activity trail for create, edits and comments", async () => {
    const issue = await createIssue(schema, { title: "Tracked", createdBy: "u1" });

    await updateIssue(
      schema,
      issue.id,
      { status: "done", priority: "urgent", assigneeId: "u2", title: "Tracked" },
      "u9"
    );
    await updateIssue(schema, issue.id, { status: "done" }, "u9");
    await addComment(schema, { issueId: issue.id, authorId: "u3", body: "hi" });

    const trail = await listActivity(schema, issue.id);
    const summary = trail
      .map((t) => `${t.kind}:${t.field ?? ""}:${t.actor_id}`)
      .sort();

    expect(summary).toEqual(
      [
        "created::u1",
        "changed:status:u9",
        "changed:priority:u9",
        "changed:assignee_id:u9",
        "commented::u3",
      ].sort()
    );
    expect(trail.find((t) => t.field === "status")).toMatchObject({
      old_value: "todo",
      new_value: "done",
    });

    await deleteIssue(schema, issue.id);
    expect(await listActivity(schema, issue.id)).toEqual([]);
  });

  it("backfills numbers on a legacy schema by age and keeps counting after", async () => {
    const legacy = generateSchemaName();
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${legacy}"`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${legacy}"."issues" (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
        status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
        created_by TEXT NOT NULL, assignee_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${legacy}"."issues" (id, title, created_by, created_at) VALUES
         ('l2', 'Second', 'u1', '2026-02-01'),
         ('l1', 'First', 'u1', '2026-01-01'),
         ('l3', 'Third', 'u1', '2026-03-01')`
    );

    try {
      expect((await getIssue(legacy, "l1"))?.number).toBe(1);
      expect((await getIssue(legacy, "l2"))?.number).toBe(2);
      expect((await getIssue(legacy, "l3"))?.number).toBe(3);

      const fresh = await createIssue(legacy, { title: "Fresh", createdBy: "u1" });
      expect(fresh.number).toBe(4);
    } finally {
      await dropProjectSchema(legacy);
    }
  });
});
