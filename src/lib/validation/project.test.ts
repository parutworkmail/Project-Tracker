import { describe, expect, it } from "vitest";

import {
  createIssueSchema,
  createProjectSchema,
  updateIssueStatusSchema,
} from "./project";

describe("createProjectSchema", () => {
  it("accepts a valid name", () => {
    expect(createProjectSchema.safeParse({ name: "My Project" }).success).toBe(
      true
    );
  });

  it("rejects an empty name", () => {
    expect(createProjectSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name longer than 80 chars", () => {
    expect(
      createProjectSchema.safeParse({ name: "a".repeat(81) }).success
    ).toBe(false);
  });

  it("accepts a name exactly at the 80 char boundary", () => {
    expect(
      createProjectSchema.safeParse({ name: "a".repeat(80) }).success
    ).toBe(true);
  });
});

describe("createIssueSchema", () => {
  it("accepts a title with no description", () => {
    const result = createIssueSchema.safeParse({ title: "Fix bug" });
    expect(result.success).toBe(true);
  });

  it("accepts a title with a description", () => {
    const result = createIssueSchema.safeParse({
      title: "Fix bug",
      description: "Details here",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string description", () => {
    const result = createIssueSchema.safeParse({
      title: "Fix bug",
      description: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(createIssueSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects a title longer than 200 chars", () => {
    expect(
      createIssueSchema.safeParse({ title: "a".repeat(201) }).success
    ).toBe(false);
  });

  it("rejects a description longer than 2000 chars", () => {
    expect(
      createIssueSchema.safeParse({
        title: "Fix bug",
        description: "a".repeat(2001),
      }).success
    ).toBe(false);
  });
});

describe("updateIssueStatusSchema", () => {
  it.each(["todo", "in_progress", "done"])("accepts status %s", (status) => {
    expect(updateIssueStatusSchema.safeParse({ status }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(
      updateIssueStatusSchema.safeParse({ status: "archived" }).success
    ).toBe(false);
  });

  it("rejects a missing status", () => {
    expect(updateIssueStatusSchema.safeParse({}).success).toBe(false);
  });
});
