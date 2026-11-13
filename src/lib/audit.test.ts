import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, deleteMany, findMany, count } = vi.hoisted(() => ({
  create: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { create, deleteMany, findMany, count } },
  DbUnavailableError: class DbUnavailableError extends Error {},
}));

// The global test setup replaces recordAudit with a no-op; these tests need the real one.
async function load() {
  return vi.importActual<typeof import("./audit")>("./audit");
}

beforeEach(() => {
  create.mockReset();
  deleteMany.mockReset();
  findMany.mockReset();
  count.mockReset();
  create.mockResolvedValue({});
  deleteMany.mockResolvedValue({ count: 0 });
  vi.resetModules();
});

describe("recordAudit", () => {
  it("writes one row with the given fields", async () => {
    const { recordAudit } = await load();

    await recordAudit({
      level: "WARN",
      category: "user",
      action: "user.deleted",
      message: "Deleted user \"bob\"",
      actorId: "u1",
      actorName: "ann",
      target: "user:bob",
      ip: "1.2.3.4",
      meta: { why: "test" },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        level: "WARN",
        category: "user",
        action: "user.deleted",
        message: "Deleted user \"bob\"",
        actorId: "u1",
        actorName: "ann",
        target: "user:bob",
        ip: "1.2.3.4",
        meta: { why: "test" },
      },
    });
  });

  it("stores missing optional fields as null/undefined and clips very long text", async () => {
    const { recordAudit } = await load();

    await recordAudit({
      level: "ERROR",
      category: "system",
      action: "a".repeat(200),
      message: "m".repeat(2000),
    });

    const data = create.mock.calls[0][0].data;
    expect(data.action).toHaveLength(80);
    expect(data.action.endsWith("…")).toBe(true);
    expect(data.message).toHaveLength(500);
    expect(data.actorId).toBeNull();
    expect(data.actorName).toBeNull();
    expect(data.meta).toBeUndefined();
  });

  it("never throws when the database write fails, it only logs to the console", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new Error("connection terminated"));
    const { recordAudit } = await load();

    await expect(
      recordAudit({ level: "INFO", category: "auth", action: "x", message: "y" })
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledWith("Could not write audit log entry:", "connection terminated");
    spy.mockRestore();
  });

  it("also survives the table not existing yet", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new Error('relation "AuditLog" does not exist'));
    const { recordAudit } = await load();

    await expect(
      recordAudit({ level: "INFO", category: "auth", action: "x", message: "y" })
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("removes rows older than 90 days only once every 200 writes", async () => {
    const { recordAudit } = await load();
    const entry = { level: "INFO", category: "auth", action: "x", message: "y" } as const;

    for (let i = 0; i < 199; i++) await recordAudit(entry);
    expect(deleteMany).not.toHaveBeenCalled();

    await recordAudit(entry);
    expect(deleteMany).toHaveBeenCalledTimes(1);

    const cutoff = deleteMany.mock.calls[0][0].where.createdAt.lt as Date;
    const days = (Date.now() - cutoff.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThan(90.1);
  });
});

describe("actor", () => {
  it("copies id and username, using null for anything missing", async () => {
    const { actor } = await load();

    expect(actor({ id: "u1", username: "ann" })).toEqual({ actorId: "u1", actorName: "ann" });
    expect(actor({})).toEqual({ actorId: null, actorName: null });
    expect(actor({ id: "u1", username: "" })).toEqual({ actorId: "u1", actorName: null });
  });
});

describe("buildAuditWhere", () => {
  it("is empty without filters", async () => {
    const { buildAuditWhere } = await load();
    expect(buildAuditWhere({})).toEqual({});
  });

  it("accepts only known levels and categories", async () => {
    const { buildAuditWhere } = await load();

    expect(buildAuditWhere({ level: "ERROR", category: "auth" })).toEqual({
      level: "ERROR",
      category: "auth",
    });
    expect(buildAuditWhere({ level: "DROP TABLE", category: "../x" })).toEqual({});
    expect(buildAuditWhere({ level: "error" })).toEqual({});
  });

  it("searches five columns, case-insensitively, trimmed and capped at 100 characters", async () => {
    const { buildAuditWhere } = await load();

    const where = buildAuditWhere({ q: `  ${"x".repeat(150)}  ` });
    expect(where.OR).toHaveLength(5);
    expect(where.OR![0]).toEqual({
      message: { contains: "x".repeat(100), mode: "insensitive" },
    });
    expect(buildAuditWhere({ q: "   " })).toEqual({});
  });
});

describe("listAudit", () => {
  it("returns the page, the totals and the last-24h counters", async () => {
    findMany.mockResolvedValue([{ id: "1" }]);
    count.mockResolvedValueOnce(120).mockResolvedValueOnce(3).mockResolvedValueOnce(7);
    const { listAudit, AUDIT_PAGE_SIZE } = await load();

    const result = await listAudit({ level: "ERROR", page: 3 });

    expect(result).toEqual({
      rows: [{ id: "1" }],
      total: 120,
      page: 3,
      pageSize: AUDIT_PAGE_SIZE,
      errorsLast24h: 3,
      warningsLast24h: 7,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { level: "ERROR" },
        skip: 2 * AUDIT_PAGE_SIZE,
        take: AUDIT_PAGE_SIZE,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    );
  });

  it("falls back to page 1 for nonsense page numbers", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const { listAudit } = await load();

    for (const page of [undefined, 0, -4, Number.NaN, 1.4]) {
      expect((await listAudit({ page })).page).toBe(1);
    }
    expect(findMany.mock.calls.every((c) => c[0].skip === 0)).toBe(true);
  });
});
