import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

const SCHEMA_NAME_PATTERN = /^proj_[a-f0-9]{24}$/;

export function generateSchemaName(): string {
  return `proj_${randomUUID().replace(/-/g, "")}`;
}

function assertValidSchemaName(schemaName: string): void {
  if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }
}

export async function provisionProjectSchema(schemaName: string): Promise<void> {
  assertValidSchemaName(schemaName);

  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

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
}

export async function dropProjectSchema(schemaName: string): Promise<void> {
  assertValidSchemaName(schemaName);
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
}

export type IssueStatus = "todo" | "in_progress" | "done";

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  created_by: string;
  assignee_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function listIssues(schemaName: string): Promise<Issue[]> {
  assertValidSchemaName(schemaName);
  return prisma.$queryRawUnsafe<Issue[]>(
    `SELECT * FROM "${schemaName}"."issues" ORDER BY created_at DESC`
  );
}

export async function createIssue(
  schemaName: string,
  data: { title: string; description?: string | null; createdBy: string }
): Promise<Issue> {
  assertValidSchemaName(schemaName);

  const id = randomUUID();

  const rows = await prisma.$queryRawUnsafe<Issue[]>(
    `INSERT INTO "${schemaName}"."issues" (id, title, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    id,
    data.title,
    data.description ?? null,
    data.createdBy
  );

  return rows[0];
}

export async function updateIssueStatus(
  schemaName: string,
  issueId: string,
  status: IssueStatus
): Promise<Issue> {
  assertValidSchemaName(schemaName);

  const rows = await prisma.$queryRawUnsafe<Issue[]>(
    `UPDATE "${schemaName}"."issues"
     SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    status,
    issueId
  );

  return rows[0];
}
