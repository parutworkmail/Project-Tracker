import { describe, expect, it } from "vitest";

import {
  SORT_COLUMNS,
  SORT_LABELS,
  SORT_MENU,
  sortColumnState,
  type SortColumn,
} from "@/lib/issueMeta";
import { parseIssueFilters, buildBoardQuery } from "@/lib/issueFilters";
import { ISSUE_SORTS } from "@/lib/projectSchema";

const COLUMNS = Object.keys(SORT_COLUMNS) as SortColumn[];

describe("sort definitions stay in step", () => {
  it("the server's sort list and the labels list contain exactly the same sorts", () => {
    expect([...ISSUE_SORTS].sort()).toEqual(Object.keys(SORT_LABELS).sort());
  });

  it("every dropdown entry and every header sort is a real sort", () => {
    for (const sort of SORT_MENU) expect(ISSUE_SORTS).toContain(sort);

    for (const column of COLUMNS) {
      expect(ISSUE_SORTS).toContain(SORT_COLUMNS[column].first);
      expect(ISSUE_SORTS).toContain(SORT_COLUMNS[column].second);
    }
  });

  it("each header toggles between two different sorts, and no two headers share one", () => {
    const seen = new Set<string>();

    for (const column of COLUMNS) {
      const { first, second } = SORT_COLUMNS[column];
      expect(first).not.toBe(second);
      expect(seen.has(first) || seen.has(second)).toBe(false);
      seen.add(first);
      seen.add(second);
    }
  });

  it("covers every task table column", () => {
    expect(COLUMNS.sort()).toEqual(
      ["assignee", "due", "number", "priority", "status", "title"].sort()
    );
  });
});

describe("sortColumnState", () => {
  it("reports which way a column is currently sorted", () => {
    expect(sortColumnState("title_asc", "title")).toBe("first");
    expect(sortColumnState("title_desc", "title")).toBe("second");
    expect(sortColumnState("title_asc", "status")).toBeNull();
    expect(sortColumnState("newest", "number")).toBe("second");
    expect(sortColumnState("oldest", "number")).toBe("first");
  });

  it("is idle for sorts that no header owns", () => {
    for (const column of COLUMNS) {
      expect(sortColumnState("updated", column)).toBeNull();
    }
  });
});

describe("sort in the address", () => {
  it("round-trips every sort through the query string", () => {
    for (const sort of Object.keys(SORT_LABELS)) {
      const filters = parseIssueFilters({ sort });
      const query = buildBoardQuery(filters);

      expect(filters.sort).toBe(sort);
      expect(parseIssueFilters(Object.fromEntries(new URLSearchParams(query))).sort).toBe(sort);
    }
  });

  it("falls back to newest for an unknown sort", () => {
    expect(parseIssueFilters({ sort: "constructor" }).sort).toBe("newest");
    expect(parseIssueFilters({ sort: "title_sideways" }).sort).toBe("newest");
  });

  it("resets to the first page when a header changes the sort", () => {
    const filters = parseIssueFilters({ page: "4", sort: "title_asc", q: "bug" });
    const next = buildBoardQuery(filters, { sort: "title_desc", page: 1 });

    expect(next).toBe("?q=bug&sort=title_desc");
  });
});
