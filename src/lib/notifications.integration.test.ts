import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  assertValidSchemaName,
  createIssue,
  dropProjectSchema,
  generateSchemaName,
  provisionProjectSchema,
  searchIssues,
  updateIssue,
  deleteIssue,
  ISSUE_SORTS,
  type IssueSort,
} from "./projectSchema";
import {
  countUnread,
  countUnreadAcross,
  countUnreadForIssue,
  createNotifications,
  listNotificationViews,
  markRead,
  markReadAcross,
} from "./notifications";
import { prisma } from "./prisma";

// Runs against the real database in throwaway schemas and throwaway users.
// Enable with: RUN_DB_INTEGRATION=1 node --env-file=.env node_modules/vitest/vitest.mjs run <this file>
const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("sorting and notifications (real database)", { timeout: 90_000 }, () => {
  const schema = generateSchemaName();
  const tag = Math.random().toString(36).slice(2, 8);
  const users = {
    ann: { id: `it_ann_${tag}`, username: `it_ann_${tag}`, name: "Zed Annie" },
    bob: { id: `it_bob_${tag}`, username: `it_bob_${tag}`, name: null as string | null },
    cat: { id: `it_cat_${tag}`, username: `it_cat_${tag}`, name: "Bee Cat" },
  };

  beforeAll(async () => {
    await provisionProjectSchema(schema);

    for (const user of Object.values(users)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "User" (id, username, name, role, "mustChangePassword", "updatedAt")
         VALUES ($1, $2, $3, 'USER'::"GlobalRole", false, now())`,
        user.id,
        user.username,
        user.name
      );
    }
  });

  afterAll(async () => {
    await dropProjectSchema(schema);
    await prisma.$executeRawUnsafe(
      `DELETE FROM "User" WHERE id = ANY($1::text[])`,
      Object.values(users).map((user) => user.id)
    );
    await prisma.$disconnect();
  });

  describe("every sort order", () => {
    const sortSchema = generateSchemaName();

    beforeAll(async () => {
      await provisionProjectSchema(sortSchema);

      const rows: {
        title: string;
        status: "todo" | "in_progress" | "done";
        priority: "low" | "medium" | "high" | "urgent";
        due?: string;
        assignee?: string;
      }[] = [
        { title: "charlie", status: "done", priority: "low", due: "2030-03-01", assignee: users.cat.id },
        { title: "Alpha", status: "todo", priority: "urgent", due: "2030-01-01", assignee: users.ann.id },
        { title: "bravo", status: "in_progress", priority: "high", assignee: users.bob.id },
        { title: "delta", status: "todo", priority: "medium", due: "2030-02-01" },
      ];

      for (const row of rows) {
        const issue = await createIssue(sortSchema, {
          title: row.title,
          createdBy: users.ann.id,
          priority: row.priority,
          dueDate: row.due ?? null,
          assigneeId: row.assignee ?? null,
        });
        if (row.status !== "todo") await updateIssue(sortSchema, issue.id, { status: row.status });
      }
    });

    afterAll(async () => {
      await dropProjectSchema(sortSchema);
    });

    const titles = async (sort: IssueSort) =>
      (await searchIssues(sortSchema, { sort })).issues.map((issue) => issue.title);

    it("runs every sort without a SQL error and returns all rows", async () => {
      for (const sort of ISSUE_SORTS) {
        const found = await searchIssues(sortSchema, { sort });
        expect(found.total, sort).toBe(4);
        expect(found.issues, sort).toHaveLength(4);
      }
    });

    it("sorts titles case-insensitively in both directions", async () => {
      expect(await titles("title_asc")).toEqual(["Alpha", "bravo", "charlie", "delta"]);
      expect(await titles("title_desc")).toEqual(["delta", "charlie", "bravo", "Alpha"]);
    });

    it("sorts by status workflow, not alphabetically", async () => {
      const asc = await searchIssues(sortSchema, { sort: "status_asc" });
      const desc = await searchIssues(sortSchema, { sort: "status_desc" });

      expect(asc.issues.map((i) => i.status)).toEqual(["todo", "todo", "in_progress", "done"]);
      expect(desc.issues.map((i) => i.status)).toEqual(["done", "in_progress", "todo", "todo"]);
    });

    it("sorts by priority both ways", async () => {
      expect(await titles("priority")).toEqual(["Alpha", "bravo", "delta", "charlie"]);
      expect(await titles("priority_low")).toEqual(["charlie", "delta", "bravo", "Alpha"]);
    });

    it("sorts by due date both ways with missing dates last", async () => {
      expect(await titles("due")).toEqual(["Alpha", "delta", "charlie", "bravo"]);
      expect(await titles("due_desc")).toEqual(["charlie", "delta", "Alpha", "bravo"]);
    });

    it("sorts by the assignee's shown name (name, else username), unassigned last", async () => {
      // shown names: "bee cat", "it_bob_<tag>", "zed annie"
      expect(await titles("assignee_asc")).toEqual(["charlie", "bravo", "Alpha", "delta"]);
      expect(await titles("assignee_desc")).toEqual(["Alpha", "bravo", "charlie", "delta"]);
    });

    it("keeps filters and paging working with a column sort", async () => {
      const page = await searchIssues(sortSchema, {
        sort: "title_desc",
        pageSize: 2,
        page: 2,
      });

      expect(page.total).toBe(4);
      expect(page.issues.map((i) => i.title)).toEqual(["bravo", "Alpha"]);

      const filtered = await searchIssues(sortSchema, { sort: "title_asc", status: "todo" });
      expect(filtered.issues.map((i) => i.title)).toEqual(["Alpha", "delta"]);
    });
  });

  describe("notifications", () => {
    it("creates the notifications table on a brand new project", async () => {
      const rows = await prisma.$queryRawUnsafe<{ reg: string | null }[]>(
        `SELECT to_regclass('"${schema}"."notifications"')::text AS reg`
      );

      expect(rows[0].reg).not.toBeNull();
    });

    it("rejects a bad schema name before touching the database", async () => {
      expect(() => assertValidSchemaName("public")).toThrow();
      await expect(countUnread("public; DROP TABLE x", users.ann.id)).rejects.toThrow();
    });

    it("stores, counts, lists and clears notifications per person", async () => {
      const issue = await createIssue(schema, { title: "Ping me", createdBy: users.ann.id });
      const other = await createIssue(schema, { title: "Other task", createdBy: users.ann.id });

      await createNotifications(schema, [
        { userId: users.bob.id, kind: "assigned", issueId: issue.id, actorId: users.ann.id },
        { userId: users.bob.id, kind: "mention", issueId: issue.id, actorId: users.ann.id, commentId: "c1" },
        { userId: users.bob.id, kind: "mention", issueId: other.id, actorId: users.cat.id },
        { userId: users.cat.id, kind: "mention", issueId: issue.id, actorId: users.ann.id },
        // Acting on yourself never notifies you.
        { userId: users.ann.id, kind: "assigned", issueId: issue.id, actorId: users.ann.id },
      ]);

      expect(await countUnread(schema, users.bob.id)).toBe(3);
      expect(await countUnread(schema, users.cat.id)).toBe(1);
      expect(await countUnread(schema, users.ann.id)).toBe(0);
      expect(await countUnreadForIssue(schema, users.bob.id, issue.id)).toBe(2);

      const project = { slug: `it-${tag}`, name: "IT project", schemaName: schema };
      const views = await listNotificationViews([project], users.bob.id);

      expect(views).toHaveLength(3);
      expect(views.every((view) => !view.read)).toBe(true);
      expect(views[0]).toMatchObject({ projectSlug: project.slug, projectName: "IT project" });
      expect(new Set(views.map((view) => view.actorLabel))).toEqual(
        new Set([`Zed Annie (${users.ann.username})`, `Bee Cat (${users.cat.username})`])
      );
      expect(views.find((view) => view.issueTitle === "Other task")?.issueNumber).toBe(other.number);

      // Reading one task clears only that task, only for that person.
      expect(await markRead(schema, users.bob.id, issue.id)).toBe(2);
      expect(await countUnread(schema, users.bob.id)).toBe(1);
      expect(await countUnread(schema, users.cat.id)).toBe(1);

      const afterOne = await listNotificationViews([project], users.bob.id);
      expect(afterOne.filter((view) => view.read)).toHaveLength(2);

      expect(await countUnreadAcross([project], users.bob.id)).toBe(1);
      expect(await markReadAcross([project], users.bob.id)).toBe(1);
      expect(await countUnreadAcross([project], users.bob.id)).toBe(0);
      expect(await markRead(schema, users.bob.id)).toBe(0);
      expect(await countUnread(schema, users.cat.id)).toBe(1);
    });

    it("removes a task's notifications when the task is deleted", async () => {
      const issue = await createIssue(schema, { title: "Short lived", createdBy: users.ann.id });

      await createNotifications(schema, [
        { userId: users.cat.id, kind: "assigned", issueId: issue.id, actorId: users.ann.id },
      ]);

      const before = await countUnreadForIssue(schema, users.cat.id, issue.id);
      expect(before).toBe(1);

      await deleteIssue(schema, issue.id);

      expect(await countUnreadForIssue(schema, users.cat.id, issue.id)).toBe(0);
    });

    it("never throws when a notification cannot be written", async () => {
      const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        await expect(
          createNotifications(schema, [
            { userId: users.cat.id, kind: "mention", issueId: "no-such-issue", actorId: users.ann.id },
          ])
        ).resolves.toBeUndefined();

        await expect(
          createNotifications("not a schema", [
            { userId: users.cat.id, kind: "mention", issueId: "x", actorId: users.ann.id },
          ])
        ).resolves.toBeUndefined();

        expect(quiet).toHaveBeenCalledTimes(2);
      } finally {
        quiet.mockRestore();
      }
    });

    it("keeps working when one project in the list is broken", async () => {
      const good = { slug: `it-good-${tag}`, name: "Good", schemaName: schema };
      const bad = { slug: `it-bad-${tag}`, name: "Bad", schemaName: "proj_00000000000000000000000000000000" };

      expect(await countUnreadAcross([bad, good], users.cat.id)).toBeGreaterThanOrEqual(1);
      expect((await listNotificationViews([bad, good], users.cat.id)).length).toBeGreaterThanOrEqual(1);
    });
  });
});
