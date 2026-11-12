import { describe, expect, it } from "vitest";

import {
  buildBoardQuery,
  hasActiveFilters,
  parseIssueFilters,
} from "./issueFilters";

describe("parseIssueFilters", () => {
  it("returns defaults for empty params", () => {
    expect(parseIssueFilters({})).toEqual({
      q: "",
      status: "",
      priority: "",
      assignee: "",
      label: "",
      sort: "newest",
      page: 1,
    });
  });

  it("keeps valid values and trims the search term", () => {
    expect(
      parseIssueFilters({
        q: "  bug  ",
        status: "done",
        priority: "urgent",
        assignee: "u1",
        label: "lab1",
        sort: "due",
        page: "3",
      })
    ).toEqual({
      q: "bug",
      status: "done",
      priority: "urgent",
      assignee: "u1",
      label: "lab1",
      sort: "due",
      page: 3,
    });
  });

  it("drops unknown enum values and bad pages", () => {
    const parsed = parseIssueFilters({
      status: "archived",
      priority: "asap",
      sort: "constructor",
      page: "-4",
    });

    expect(parsed.status).toBe("");
    expect(parsed.priority).toBe("");
    expect(parsed.sort).toBe("newest");
    expect(parsed.page).toBe(1);
    expect(parseIssueFilters({ page: "abc" }).page).toBe(1);
  });

  it("uses the first value of repeated params", () => {
    expect(parseIssueFilters({ q: ["a", "b"] }).q).toBe("a");
  });
});

describe("buildBoardQuery", () => {
  const base = parseIssueFilters({});

  it("is empty for defaults", () => {
    expect(buildBoardQuery(base)).toBe("");
  });

  it("encodes set filters and omits defaults", () => {
    const filters = parseIssueFilters({ q: "a b", status: "todo", page: "2" });
    expect(buildBoardQuery(filters)).toBe("?q=a+b&status=todo&page=2");
  });

  it("applies overrides", () => {
    const filters = parseIssueFilters({ status: "todo", page: "2" });
    expect(buildBoardQuery(filters, { page: 1, status: "" })).toBe("");
  });

  it("round-trips the label filter", () => {
    const filters = parseIssueFilters({ label: "abc" });
    expect(buildBoardQuery(filters)).toBe("?label=abc");
    expect(buildBoardQuery(filters, { label: "" })).toBe("");
  });
});

describe("hasActiveFilters", () => {
  it("ignores the page number but flags any filter or non-default sort", () => {
    expect(hasActiveFilters(parseIssueFilters({ page: "4" }))).toBe(false);
    expect(hasActiveFilters(parseIssueFilters({ sort: "oldest" }))).toBe(true);
    expect(hasActiveFilters(parseIssueFilters({ q: "x" }))).toBe(true);
    expect(hasActiveFilters(parseIssueFilters({ label: "x" }))).toBe(true);
  });
});
