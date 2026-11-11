import { describe, expect, it } from "vitest";

import {
  createIssueSchema,
  createProjectSchema,
  createCommentSchema,
  updateIssueSchema,
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

describe('createIssueSchema extra fields', () => {
  it('accepts priority, due date and assignee', () => {
    expect(
      createIssueSchema.safeParse({
        title: 'x',
        priority: 'urgent',
        dueDate: '2028-02-29',
        assigneeId: 'u1',
      }).success
    ).toBe(true);
  });

  it('accepts empty-string and null optional values', () => {
    expect(
      createIssueSchema.safeParse({ title: 'x', dueDate: '', assigneeId: null, description: null })
        .success
    ).toBe(true);
  });

  it('rejects impossible calendar dates and malformed dates', () => {
    expect(createIssueSchema.safeParse({ title: 'x', dueDate: '2027-02-29' }).success).toBe(false);
    expect(createIssueSchema.safeParse({ title: 'x', dueDate: '01/02/2027' }).success).toBe(false);
  });

  it('rejects an unknown priority and a whitespace-only title', () => {
    expect(createIssueSchema.safeParse({ title: 'x', priority: 'asap' }).success).toBe(false);
    expect(createIssueSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('updateIssueSchema', () => {
  it('accepts any single field', () => {
    expect(updateIssueSchema.safeParse({ title: 'New' }).success).toBe(true);
    expect(updateIssueSchema.safeParse({ priority: 'low' }).success).toBe(true);
    expect(updateIssueSchema.safeParse({ assigneeId: null }).success).toBe(true);
    expect(updateIssueSchema.safeParse({ dueDate: null }).success).toBe(true);
  });

  it('rejects an empty object', () => {
    expect(updateIssueSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an invalid status or empty title', () => {
    expect(updateIssueSchema.safeParse({ status: 'nope' }).success).toBe(false);
    expect(updateIssueSchema.safeParse({ title: '' }).success).toBe(false);
  });
});

describe('createCommentSchema', () => {
  it('trims and accepts a normal comment', () => {
    const result = createCommentSchema.safeParse({ body: '  hi  ' });
    expect(result.success && result.data.body).toBe('hi');
  });

  it('rejects empty, whitespace-only and over-long comments', () => {
    expect(createCommentSchema.safeParse({ body: '' }).success).toBe(false);
    expect(createCommentSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(createCommentSchema.safeParse({ body: 'a'.repeat(2001) }).success).toBe(false);
  });
});
