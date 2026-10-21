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
  createIssue,
  dropProjectSchema,
  generateSchemaName,
  listIssues,
  provisionProjectSchema,
  updateIssueStatus,
} from "./projectSchema";

describe("generateSchemaName", () => {
  it("produces a 'proj_' prefixed 32-hex-char schema name", () => {
    const name = generateSchemaName();
    expect(name).toMatch(/^proj_[a-f0-9]{32}$/);
  });

  it("produces unique names on repeated calls", () => {
    expect(generateSchemaName()).not.toBe(generateSchemaName());
  });
});

describe("schema name validation guard", () => {
  beforeEach(() => {
    executeRawUnsafe.mockReset();
    queryRawUnsafe.mockReset();
  });

  it("provisionProjectSchema rejects an invalid schema name without touching the DB", async () => {
    await expect(
      provisionProjectSchema("'; DROP TABLE users; --")
    ).rejects.toThrow(/Invalid schema name/);
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("provisionProjectSchema runs CREATE SCHEMA + CREATE TABLE for a valid name", async () => {
    const schemaName = generateSchemaName();
    executeRawUnsafe.mockResolvedValue(undefined);

    await provisionProjectSchema(schemaName);

    expect(executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("CREATE SCHEMA");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain(schemaName);
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("CREATE TABLE");
  });

  it("dropProjectSchema rejects an invalid schema name without touching the DB", async () => {
    await expect(dropProjectSchema("not valid")).rejects.toThrow(
      /Invalid schema name/
    );
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("dropProjectSchema runs DROP SCHEMA CASCADE for a valid name", async () => {
    const schemaName = generateSchemaName();
    executeRawUnsafe.mockResolvedValue(undefined);

    await dropProjectSchema(schemaName);

    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("DROP SCHEMA");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("CASCADE");
  });

  it("listIssues rejects an invalid schema name without touching the DB", async () => {
    await expect(listIssues("bad name")).rejects.toThrow(
      /Invalid schema name/
    );
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("listIssues queries the project's own schema", async () => {
    const schemaName = generateSchemaName();
    queryRawUnsafe.mockResolvedValue([]);

    await listIssues(schemaName);

    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(queryRawUnsafe.mock.calls[0][0]).toContain(schemaName);
    expect(queryRawUnsafe.mock.calls[0][0]).toContain("ORDER BY created_at DESC");
  });

  it("createIssue rejects an invalid schema name without touching the DB", async () => {
    await expect(
      createIssue("bad name", { title: "x", createdBy: "u1" })
    ).rejects.toThrow(/Invalid schema name/);
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("createIssue inserts with the given title/description/createdBy", async () => {
    const schemaName = generateSchemaName();
    const fakeIssue = { id: "issue-1", title: "Fix bug" };
    queryRawUnsafe.mockResolvedValue([fakeIssue]);

    const result = await createIssue(schemaName, {
      title: "Fix bug",
      description: "Details",
      createdBy: "user-1",
    });

    expect(result).toEqual(fakeIssue);
    expect(queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO"),
      expect.any(String),
      "Fix bug",
      "Details",
      "user-1"
    );
  });

  it("createIssue defaults a missing description to null", async () => {
    const schemaName = generateSchemaName();
    queryRawUnsafe.mockResolvedValue([{}]);

    await createIssue(schemaName, { title: "No desc", createdBy: "user-1" });

    expect(queryRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "No desc",
      null,
      "user-1"
    );
  });

  it("updateIssueStatus rejects an invalid schema name without touching the DB", async () => {
    await expect(
      updateIssueStatus("bad name", "issue-1", "done")
    ).rejects.toThrow(/Invalid schema name/);
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("updateIssueStatus updates status for the given issue id", async () => {
    const schemaName = generateSchemaName();
    const fakeIssue = { id: "issue-1", status: "done" };
    queryRawUnsafe.mockResolvedValue([fakeIssue]);

    const result = await updateIssueStatus(schemaName, "issue-1", "done");

    expect(result).toEqual(fakeIssue);
    expect(queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE"),
      "done",
      "issue-1"
    );
  });
});
