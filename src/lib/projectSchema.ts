import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

const SCHEMA_NAME_PATTERN = /^proj_[a-f0-9]{32}$/;

export const ISSUE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export type IssueStatus = "todo" | "in_progress" | "done";

export const ISSUE_SORTS = [
  "newest",
  "oldest",
  "updated",
  "priority",
  "due",
] as const;
export type IssueSort = (typeof ISSUE_SORTS)[number];

export const ISSUES_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export const LABEL_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];
export const MAX_LABELS = 30;

export interface IssueLabel {
  id: string;
  name: string;
  color: LabelColor;
}

export function generateSchemaName(): string {
  return `proj_${randomUUID().replace(/-/g, "")}`;
}

function assertValidSchemaName(schemaName: string): void {
  if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }
}

const ensuredSchemas = new Set<string>();
const ensuring = new Map<string, Promise<void>>();

// Idempotent: creates the issue/comment tables and adds columns introduced
// after a project was first provisioned, so older project schemas upgrade
// themselves on first use. Memoized per process once it succeeds, and
// concurrent first calls share one in-flight run.
export async function ensureProjectSchema(schemaName: string): Promise<void> {
  assertValidSchemaName(schemaName);

  if (ensuredSchemas.has(schemaName)) {
    return;
  }

  let inFlight = ensuring.get(schemaName);

  if (!inFlight) {
    inFlight = runEnsureWithRetry(schemaName)
      .then(() => {
        ensuredSchemas.add(schemaName);
      })
      .finally(() => {
        ensuring.delete(schemaName);
      });
    ensuring.set(schemaName, inFlight);
  }

  return inFlight;
}

async function runEnsureWithRetry(schemaName: string): Promise<void> {
  try {
    await runEnsure(schemaName);
  } catch {
    // Another instance may be creating the same objects right now; retry once.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await runEnsure(schemaName);
  }
}

async function runEnsure(schemaName: string): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"."issues" (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
      created_by TEXT NOT NULL,
      assignee_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // ALTER ... IF NOT EXISTS still takes an ACCESS EXCLUSIVE lock, so only
  // alter when a column is actually missing.
  const existing = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'issues'`,
    schemaName
  );
  const columns = new Set((existing ?? []).map((row) => row.column_name));

  if (!columns.has("priority")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${schemaName}"."issues"
       ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
         CHECK (priority IN ('low', 'medium', 'high', 'urgent'))`
    );
  }

  if (!columns.has("due_date")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${schemaName}"."issues" ADD COLUMN IF NOT EXISTS due_date DATE`
    );
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"."comments" (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES "${schemaName}"."issues"(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS comments_issue_id_idx ON "${schemaName}"."comments" (issue_id, created_at)`
  );

  // One atomic block: a half-applied numbering upgrade would be skipped on
  // retry because the column would already exist.
  if (!columns.has("number")) {
    await prisma.$executeRawUnsafe(`
      DO $upgrade$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${schemaName}' AND table_name = 'issues' AND column_name = 'number'
        ) THEN
          CREATE SEQUENCE IF NOT EXISTS "${schemaName}"."issue_number_seq";
          ALTER TABLE "${schemaName}"."issues" ADD COLUMN number INTEGER;
          UPDATE "${schemaName}"."issues" i SET number = r.rn
          FROM (
            SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
            FROM "${schemaName}"."issues"
          ) r
          WHERE i.id = r.id;
          PERFORM setval(
            '"${schemaName}"."issue_number_seq"',
            COALESCE((SELECT MAX(number) FROM "${schemaName}"."issues"), 0) + 1,
            false
          );
          ALTER TABLE "${schemaName}"."issues"
            ALTER COLUMN number SET DEFAULT nextval('"${schemaName}"."issue_number_seq"');
          ALTER TABLE "${schemaName}"."issues" ALTER COLUMN number SET NOT NULL;
          CREATE UNIQUE INDEX IF NOT EXISTS issues_number_key
            ON "${schemaName}"."issues" (number);
        END IF;
      END
      $upgrade$
    `);
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"."activity" (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES "${schemaName}"."issues"(id) ON DELETE CASCADE,
      actor_id TEXT,
      kind TEXT NOT NULL,
      field TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS activity_issue_id_idx ON "${schemaName}"."activity" (issue_id, created_at)`
  );

  const colorList = LABEL_COLORS.map((color) => `'${color}'`).join(", ");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"."labels" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'gray' CHECK (color IN (${colorList})),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS labels_name_key ON "${schemaName}"."labels" (lower(name))`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"."issue_labels" (
      issue_id TEXT NOT NULL REFERENCES "${schemaName}"."issues"(id) ON DELETE CASCADE,
      label_id TEXT NOT NULL REFERENCES "${schemaName}"."labels"(id) ON DELETE CASCADE,
      PRIMARY KEY (issue_id, label_id)
    )
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS issue_labels_label_idx ON "${schemaName}"."issue_labels" (label_id)`
  );
}

export async function provisionProjectSchema(schemaName: string): Promise<void> {
  assertValidSchemaName(schemaName);

  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await ensureProjectSchema(schemaName);
}

export async function dropProjectSchema(schemaName: string): Promise<void> {
  assertValidSchemaName(schemaName);
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  ensuredSchemas.delete(schemaName);
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  due_date: string | null;
  created_by: string;
  assignee_id: string | null;
  created_at: Date;
  updated_at: Date;
  labels: IssueLabel[];
}

function issueColumns(schemaName: string): string {
  return `id, number, title, description, status, priority,
  to_char(due_date, 'YYYY-MM-DD') AS due_date,
  created_by, assignee_id, created_at, updated_at,
  COALESCE((
    SELECT json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color) ORDER BY lower(l.name))
    FROM "${schemaName}"."issue_labels" il
    JOIN "${schemaName}"."labels" l ON l.id = il.label_id
    WHERE il.issue_id = issues.id
  ), '[]'::json) AS labels`;
}

export async function listIssues(schemaName: string): Promise<Issue[]> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  return prisma.$queryRawUnsafe<Issue[]>(
    `SELECT ${issueColumns(schemaName)} FROM "${schemaName}"."issues" ORDER BY created_at DESC`
  );
}

export interface IssueSearchOptions {
  q?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee?: string;
  label?: string;
  sort?: IssueSort;
  page?: number;
  pageSize?: number;
}

const ORDER_BY: Record<IssueSort, string> = {
  newest: "created_at DESC, id ASC",
  oldest: "created_at ASC, id ASC",
  updated: "updated_at DESC, id ASC",
  priority: `CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC, created_at DESC, id ASC`,
  due: "due_date ASC NULLS LAST, created_at DESC, id ASC",
};

export async function searchIssues(
  schemaName: string,
  options: IssueSearchOptions = {}
): Promise<{ issues: Issue[]; total: number; page: number; pageSize: number }> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (options.q) {
    values.push(`%${options.q.replace(/[\\%_]/g, "\\$&")}%`);
    conditions.push(
      `(title ILIKE $${values.length} OR description ILIKE $${values.length})`
    );
  }

  if (options.status) {
    values.push(options.status);
    conditions.push(`status = $${values.length}`);
  }

  if (options.priority) {
    values.push(options.priority);
    conditions.push(`priority = $${values.length}`);
  }

  if (options.assignee === "unassigned") {
    conditions.push(`assignee_id IS NULL`);
  } else if (options.assignee) {
    values.push(options.assignee);
    conditions.push(`assignee_id = $${values.length}`);
  }

  if (options.label) {
    values.push(options.label);
    conditions.push(
      `EXISTS (SELECT 1 FROM "${schemaName}"."issue_labels" fl WHERE fl.issue_id = issues.id AND fl.label_id = $${values.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sort =
    options.sort && Object.hasOwn(ORDER_BY, options.sort)
      ? options.sort
      : "newest";
  const orderBy = ORDER_BY[sort];
  const requestedPage = Number(options.page);
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.floor(requestedPage)), 1_000_000)
    : 1;
  const pageSize = Number.isFinite(Number(options.pageSize))
    ? Math.min(Math.max(1, Math.floor(Number(options.pageSize))), MAX_PAGE_SIZE)
    : ISSUES_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const [issues, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<Issue[]>(
      `SELECT ${issueColumns(schemaName)} FROM "${schemaName}"."issues"
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${pageSize} OFFSET ${offset}`,
      ...values
    ),
    prisma.$queryRawUnsafe<{ count: bigint | number | string }[]>(
      `SELECT COUNT(*) AS count FROM "${schemaName}"."issues" ${where}`,
      ...values
    ),
  ]);

  return {
    issues,
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getIssue(
  schemaName: string,
  issueId: string
): Promise<Issue | null> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const rows = await prisma.$queryRawUnsafe<Issue[]>(
    `SELECT ${issueColumns(schemaName)} FROM "${schemaName}"."issues" WHERE id = $1`,
    issueId
  );

  return rows[0] ?? null;
}

export async function createIssue(
  schemaName: string,
  data: {
    title: string;
    description?: string | null;
    createdBy: string;
    priority?: IssuePriority;
    dueDate?: string | null;
    assigneeId?: string | null;
  }
): Promise<Issue> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const id = randomUUID();

  const rows = await prisma.$queryRawUnsafe<Issue[]>(
    `INSERT INTO "${schemaName}"."issues"
       (id, title, description, created_by, priority, due_date, assignee_id)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7)
     RETURNING ${issueColumns(schemaName)}`,
    id,
    data.title,
    data.description ?? null,
    data.createdBy,
    data.priority ?? "medium",
    data.dueDate ?? null,
    data.assigneeId ?? null
  );

  await recordActivity(schemaName, [
    { issueId: id, actorId: data.createdBy, kind: "created" },
  ]);

  return rows[0];
}

export interface IssuePatch {
  title?: string;
  description?: string | null;
  status?: IssueStatus;
  priority?: IssuePriority;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export interface ActivityEntry {
  issueId: string;
  actorId: string | null;
  kind: "created" | "changed" | "commented";
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

const ACTIVITY_VALUE_MAX = 200;

function clip(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.length > ACTIVITY_VALUE_MAX
    ? `${value.slice(0, ACTIVITY_VALUE_MAX)}…`
    : value;
}

export function diffIssue(
  before: Issue,
  patch: IssuePatch
): Omit<ActivityEntry, "issueId" | "actorId">[] {
  const changes: Omit<ActivityEntry, "issueId" | "actorId">[] = [];

  function check(
    field: string,
    oldValue: string | null,
    newValue: string | null | undefined,
    hideValues = false
  ) {
    if (newValue === undefined || newValue === oldValue) return;

    changes.push({
      kind: "changed",
      field,
      oldValue: hideValues ? null : clip(oldValue),
      newValue: hideValues ? null : clip(newValue),
    });
  }

  check("title", before.title, patch.title);
  check("description", before.description ?? null, patch.description, true);
  check("status", before.status, patch.status);
  check("priority", before.priority, patch.priority);
  check("due_date", before.due_date, patch.dueDate);
  check("assignee_id", before.assignee_id, patch.assigneeId);

  return changes;
}

export async function recordActivity(
  schemaName: string,
  entries: ActivityEntry[]
): Promise<void> {
  assertValidSchemaName(schemaName);

  // The audit trail must never block the action it describes.
  try {
    for (const entry of entries) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${schemaName}"."activity"
           (id, issue_id, actor_id, kind, field, old_value, new_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        randomUUID(),
        entry.issueId,
        entry.actorId,
        entry.kind,
        entry.field ?? null,
        entry.oldValue ?? null,
        entry.newValue ?? null
      );
    }
  } catch (error) {
    console.error("Could not record issue activity", error);
  }
}

export interface IssueActivity {
  id: string;
  issue_id: string;
  actor_id: string | null;
  kind: ActivityEntry["kind"];
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: Date;
}

export async function listActivity(
  schemaName: string,
  issueId: string
): Promise<IssueActivity[]> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  return prisma.$queryRawUnsafe<IssueActivity[]>(
    `SELECT id, issue_id, actor_id, kind, field, old_value, new_value, created_at
     FROM "${schemaName}"."activity"
     WHERE issue_id = $1
     ORDER BY created_at DESC, id ASC
     LIMIT 100`,
    issueId
  );
}

export async function updateIssue(
  schemaName: string,
  issueId: string,
  patch: IssuePatch,
  actorId?: string
): Promise<Issue | null> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const before = actorId ? await getIssue(schemaName, issueId) : null;

  const sets: string[] = [];
  const values: unknown[] = [];

  function add(column: string, value: unknown, cast = "") {
    values.push(value);
    sets.push(`${column} = $${values.length}${cast}`);
  }

  if (patch.title !== undefined) add("title", patch.title);
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.priority !== undefined) add("priority", patch.priority);
  if (patch.dueDate !== undefined) add("due_date", patch.dueDate, "::date");
  if (patch.assigneeId !== undefined) add("assignee_id", patch.assigneeId);

  if (sets.length === 0) {
    return getIssue(schemaName, issueId);
  }

  values.push(issueId);

  const rows = await prisma.$queryRawUnsafe<Issue[]>(
    `UPDATE "${schemaName}"."issues"
     SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${values.length}
     RETURNING ${issueColumns(schemaName)}`,
    ...values
  );

  if (before && actorId && rows[0]) {
    await recordActivity(
      schemaName,
      diffIssue(before, patch).map((change) => ({
        ...change,
        issueId,
        actorId,
      }))
    );
  }

  return rows[0] ?? null;
}

export async function updateIssueStatus(
  schemaName: string,
  issueId: string,
  status: IssueStatus
): Promise<Issue | null> {
  return updateIssue(schemaName, issueId, { status });
}

export async function deleteIssue(
  schemaName: string,
  issueId: string
): Promise<void> {
  assertValidSchemaName(schemaName);

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${schemaName}"."issues" WHERE id = $1`,
    issueId
  );
}

export async function unassignUserIssues(
  schemaName: string,
  userId: string
): Promise<number> {
  assertValidSchemaName(schemaName);

  return prisma.$executeRawUnsafe(
    `UPDATE "${schemaName}"."issues"
     SET assignee_id = NULL, updated_at = now()
     WHERE assignee_id = $1`,
    userId
  );
}

export async function listLabels(schemaName: string): Promise<IssueLabel[]> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  return prisma.$queryRawUnsafe<IssueLabel[]>(
    `SELECT id, name, color FROM "${schemaName}"."labels" ORDER BY lower(name) ASC`
  );
}

export async function createLabel(
  schemaName: string,
  data: { name: string; color: LabelColor }
): Promise<{ label: IssueLabel } | { error: "exists" | "limit" }> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const countRows = await prisma.$queryRawUnsafe<{ count: bigint | number | string }[]>(
    `SELECT COUNT(*) AS count FROM "${schemaName}"."labels"`
  );

  if (Number(countRows[0]?.count ?? 0) >= MAX_LABELS) {
    return { error: "limit" };
  }

  const rows = await prisma.$queryRawUnsafe<IssueLabel[]>(
    `INSERT INTO "${schemaName}"."labels" (id, name, color)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id, name, color`,
    randomUUID(),
    data.name,
    data.color
  );

  return rows[0] ? { label: rows[0] } : { error: "exists" };
}

export async function deleteLabel(
  schemaName: string,
  labelId: string
): Promise<IssueLabel | null> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const rows = await prisma.$queryRawUnsafe<IssueLabel[]>(
    `DELETE FROM "${schemaName}"."labels" WHERE id = $1 RETURNING id, name, color`,
    labelId
  );

  return rows[0] ?? null;
}

export async function setIssueLabels(
  schemaName: string,
  issueId: string,
  labelIds: string[],
  actorId: string
): Promise<"ok" | "not_found" | "unknown_label"> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const wantedIds = [...new Set(labelIds)];

  const exists = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${schemaName}"."issues" WHERE id = $1`,
    issueId
  );

  if (!exists[0]) return "not_found";

  const wanted = wantedIds.length
    ? await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
        `SELECT id, name FROM "${schemaName}"."labels" WHERE id = ANY($1::text[])`,
        wantedIds
      )
    : [];

  if (wanted.length !== wantedIds.length) return "unknown_label";

  const current = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT l.id, l.name FROM "${schemaName}"."issue_labels" il
     JOIN "${schemaName}"."labels" l ON l.id = il.label_id
     WHERE il.issue_id = $1`,
    issueId
  );

  const currentIds = new Set(current.map((label) => label.id));
  const wantedSet = new Set(wantedIds);
  const added = wanted.filter((label) => !currentIds.has(label.id));
  const removed = current.filter((label) => !wantedSet.has(label.id));

  if (removed.length) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "${schemaName}"."issue_labels"
       WHERE issue_id = $1 AND label_id = ANY($2::text[])`,
      issueId,
      removed.map((label) => label.id)
    );
  }

  if (added.length) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}"."issue_labels" (issue_id, label_id)
       SELECT $1, id FROM "${schemaName}"."labels" WHERE id = ANY($2::text[])
       ON CONFLICT DO NOTHING`,
      issueId,
      added.map((label) => label.id)
    );
  }

  await recordActivity(schemaName, [
    ...added.map((label) => ({
      issueId,
      actorId,
      kind: "changed" as const,
      field: "label",
      oldValue: null,
      newValue: label.name,
    })),
    ...removed.map((label) => ({
      issueId,
      actorId,
      kind: "changed" as const,
      field: "label",
      oldValue: label.name,
      newValue: null,
    })),
  ]);

  return "ok";
}

export interface IssueComment {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  created_at: Date;
}

export async function listComments(
  schemaName: string,
  issueId: string
): Promise<IssueComment[]> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  return prisma.$queryRawUnsafe<IssueComment[]>(
    `SELECT id, issue_id, author_id, body, created_at
     FROM "${schemaName}"."comments"
     WHERE issue_id = $1
     ORDER BY created_at ASC`,
    issueId
  );
}

export async function addComment(
  schemaName: string,
  data: { issueId: string; authorId: string; body: string }
): Promise<IssueComment | null> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const rows = await prisma.$queryRawUnsafe<IssueComment[]>(
    `INSERT INTO "${schemaName}"."comments" (id, issue_id, author_id, body)
     SELECT $1::text, i.id, $3::text, $4::text FROM "${schemaName}"."issues" i WHERE i.id = $2
     RETURNING id, issue_id, author_id, body, created_at`,
    randomUUID(),
    data.issueId,
    data.authorId,
    data.body
  );

  if (rows[0]) {
    await recordActivity(schemaName, [
      { issueId: data.issueId, actorId: data.authorId, kind: "commented" },
    ]);
  }

  return rows[0] ?? null;
}

export async function getComment(
  schemaName: string,
  commentId: string
): Promise<IssueComment | null> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const rows = await prisma.$queryRawUnsafe<IssueComment[]>(
    `SELECT id, issue_id, author_id, body, created_at
     FROM "${schemaName}"."comments" WHERE id = $1`,
    commentId
  );

  return rows[0] ?? null;
}

export async function deleteComment(
  schemaName: string,
  commentId: string
): Promise<void> {
  assertValidSchemaName(schemaName);

  await prisma.$executeRawUnsafe(
    `DELETE FROM "${schemaName}"."comments" WHERE id = $1`,
    commentId
  );
}
