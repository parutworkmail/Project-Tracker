import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { assertValidSchemaName, ensureProjectSchema } from "@/lib/projectSchema";
import { userLabel } from "@/lib/issueMeta";

export type NotificationKind = "mention" | "assigned";

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  issueId: string;
  actorId: string | null;
  commentId?: string | null;
}

export interface ProjectRef {
  slug: string;
  name: string;
  schemaName: string;
}

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  projectSlug: string;
  projectName: string;
  issueId: string;
  issueNumber: number;
  issueTitle: string;
  actorLabel: string;
  createdAt: string;
  read: boolean;
}

export const MAX_USER_PROJECTS = 50;

const toNumber = (value: bigint | number | string | null | undefined) =>
  Number(value ?? 0);

// A notification must never block the action that caused it, so this swallows errors.
export async function createNotifications(
  schemaName: string,
  entries: NewNotification[]
): Promise<void> {
  const wanted = entries.filter((entry) => entry.userId !== entry.actorId);

  if (wanted.length === 0) return;

  try {
    assertValidSchemaName(schemaName);
    await ensureProjectSchema(schemaName);

    for (const entry of wanted) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${schemaName}"."notifications"
           (id, user_id, kind, issue_id, comment_id, actor_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        randomUUID(),
        entry.userId,
        entry.kind,
        entry.issueId,
        entry.commentId ?? null,
        entry.actorId
      );
    }
  } catch (error) {
    console.error("Could not create notifications", error);
  }
}

export async function countUnread(schemaName: string, userId: string): Promise<number> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const rows = await prisma.$queryRawUnsafe<{ count: bigint | number | string }[]>(
    `SELECT COUNT(*) AS count FROM "${schemaName}"."notifications"
     WHERE user_id = $1 AND read_at IS NULL`,
    userId
  );

  return toNumber(rows[0]?.count);
}

export async function countUnreadForIssue(
  schemaName: string,
  userId: string,
  issueId: string
): Promise<number> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const rows = await prisma.$queryRawUnsafe<{ count: bigint | number | string }[]>(
    `SELECT COUNT(*) AS count FROM "${schemaName}"."notifications"
     WHERE user_id = $1 AND issue_id = $2 AND read_at IS NULL`,
    userId,
    issueId
  );

  return toNumber(rows[0]?.count);
}

export async function markRead(
  schemaName: string,
  userId: string,
  issueId?: string
): Promise<number> {
  assertValidSchemaName(schemaName);
  await ensureProjectSchema(schemaName);

  const values: unknown[] = [userId];
  let extra = "";

  if (issueId) {
    values.push(issueId);
    extra = ` AND issue_id = $2`;
  }

  return prisma.$executeRawUnsafe(
    `UPDATE "${schemaName}"."notifications" SET read_at = now()
     WHERE user_id = $1 AND read_at IS NULL${extra}`,
    ...values
  );
}

// Projects the person belongs to, as a member or as an assigned project admin.
export async function listUserProjects(userId: string): Promise<ProjectRef[]> {
  return prisma.project.findMany({
    where: {
      OR: [{ members: { some: { userId } } }, { admins: { some: { userId } } }],
    },
    orderBy: { name: "asc" },
    take: MAX_USER_PROJECTS,
    select: { slug: true, name: true, schemaName: true },
  });
}

// One broken project must not hide the others, so failures count as zero.
export async function countUnreadAcross(
  projects: ProjectRef[],
  userId: string
): Promise<number> {
  const settled = await Promise.allSettled(
    projects.map((project) => countUnread(project.schemaName, userId))
  );

  return settled.reduce(
    (sum, result) => sum + (result.status === "fulfilled" ? result.value : 0),
    0
  );
}

export async function markReadAcross(
  projects: ProjectRef[],
  userId: string
): Promise<number> {
  const settled = await Promise.allSettled(
    projects.map((project) => markRead(project.schemaName, userId))
  );

  return settled.reduce(
    (sum, result) => sum + (result.status === "fulfilled" ? result.value : 0),
    0
  );
}

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  issue_id: string;
  actor_id: string | null;
  read_at: Date | null;
  created_at: Date;
  number: number;
  title: string;
}

export async function listNotificationViews(
  projects: ProjectRef[],
  userId: string,
  options: { perProject?: number; total?: number } = {}
): Promise<NotificationView[]> {
  const perProject = options.perProject ?? 20;
  const total = options.total ?? 30;

  const settled = await Promise.allSettled(
    projects.map(async (project) => {
      assertValidSchemaName(project.schemaName);
      await ensureProjectSchema(project.schemaName);

      const rows = await prisma.$queryRawUnsafe<NotificationRow[]>(
        `SELECT n.id, n.kind, n.issue_id, n.actor_id, n.read_at, n.created_at,
                i.number, i.title
         FROM "${project.schemaName}"."notifications" n
         JOIN "${project.schemaName}"."issues" i ON i.id = n.issue_id
         WHERE n.user_id = $1
         ORDER BY n.created_at DESC
         LIMIT ${perProject}`,
        userId
      );

      return rows.map((row) => ({ project, row }));
    })
  );

  const found = settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => b.row.created_at.getTime() - a.row.created_at.getTime())
    .slice(0, total);

  const actorIds = [
    ...new Set(found.map((entry) => entry.row.actor_id).filter((id): id is string => !!id)),
  ];

  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, username: true, name: true },
      })
    : [];
  const names = new Map(actors.map((actor) => [actor.id, userLabel(actor)]));

  return found.map(({ project, row }) => ({
    id: row.id,
    kind: row.kind,
    projectSlug: project.slug,
    projectName: project.name,
    issueId: row.issue_id,
    issueNumber: row.number,
    issueTitle: row.title,
    actorLabel: row.actor_id ? (names.get(row.actor_id) ?? "A former member") : "Someone",
    createdAt: row.created_at.toISOString(),
    read: row.read_at !== null,
  }));
}
