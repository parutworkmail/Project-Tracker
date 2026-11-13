import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const AUDIT_LEVELS = ["INFO", "WARN", "ERROR"] as const;
export type AuditLevel = (typeof AUDIT_LEVELS)[number];

export const AUDIT_CATEGORIES = ["auth", "user", "project", "system"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_PAGE_SIZE = 50;
const RETENTION_DAYS = 90;
const PRUNE_EVERY_N_WRITES = 200;

export interface AuditEntry {
  level: AuditLevel;
  category: AuditCategory;
  // Short machine-readable name, e.g. "login.failed" or "user.deleted".
  action: string;
  // One readable sentence for the log page. Never put passwords or tokens in it.
  message: string;
  actorId?: string | null;
  actorName?: string | null;
  target?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown> | null;
}

// Who is doing it, taken from a signed-in session's user.
export function actor(user: { id?: string | null; username?: string | null }) {
  return { actorId: user.id ?? null, actorName: user.username || null };
}

export function clip(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

let writes = 0;

// Deleting old rows is best effort and rare, so the table cannot grow forever.
async function maybePrune(): Promise<void> {
  writes += 1;

  if (writes % PRUNE_EVERY_N_WRITES !== 0) return;

  await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } },
  });
}

// Writes one row. It NEVER throws: the audit trail must not break the action it
// describes, and when the database itself is down there is nowhere to write, so
// that case only reaches the server console.
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        level: entry.level,
        category: entry.category,
        action: clip(entry.action, 80) ?? "unknown",
        message: clip(entry.message, 500) ?? "",
        actorId: clip(entry.actorId, 64),
        actorName: clip(entry.actorName, 80),
        target: clip(entry.target, 200),
        ip: clip(entry.ip, 64),
        meta: entry.meta ? (entry.meta as Prisma.InputJsonValue) : undefined,
      },
    });

    await maybePrune();
  } catch (error) {
    console.error(
      "Could not write audit log entry:",
      error instanceof Error ? error.message : error
    );
  }
}

export interface AuditQuery {
  level?: string;
  category?: string;
  q?: string;
  page?: number;
}

export interface AuditPage {
  rows: {
    id: string;
    level: string;
    category: string;
    action: string;
    message: string;
    actorName: string | null;
    target: string | null;
    ip: string | null;
    meta: unknown;
    createdAt: Date;
  }[];
  total: number;
  page: number;
  pageSize: number;
  errorsLast24h: number;
  warningsLast24h: number;
}

export function buildAuditWhere(query: AuditQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.level && (AUDIT_LEVELS as readonly string[]).includes(query.level)) {
    where.level = query.level;
  }

  if (query.category && (AUDIT_CATEGORIES as readonly string[]).includes(query.category)) {
    where.category = query.category;
  }

  const text = query.q?.trim().slice(0, 100);

  if (text) {
    const contains = { contains: text, mode: "insensitive" as const };
    where.OR = [
      { message: contains },
      { action: contains },
      { actorName: contains },
      { target: contains },
      { ip: contains },
    ];
  }

  return where;
}

export async function listAudit(query: AuditQuery): Promise<AuditPage> {
  const where = buildAuditWhere(query);
  const requested = Math.floor(Number(query.page));
  const page = Number.isFinite(requested) && requested > 1 ? Math.min(requested, 100_000) : 1;
  const since = new Date(Date.now() - 86_400_000);

  const [rows, total, errorsLast24h, warningsLast24h] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { level: "ERROR", createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { level: "WARN", createdAt: { gte: since } } }),
  ]);

  return { rows, total, page, pageSize: AUDIT_PAGE_SIZE, errorsLast24h, warningsLast24h };
}
