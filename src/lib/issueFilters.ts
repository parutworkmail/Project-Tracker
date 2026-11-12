import {
  ISSUE_PRIORITY_LIST,
  ISSUE_STATUSES,
  type IssuePriority,
  type IssueSort,
  type IssueStatus,
} from "@/lib/issueMeta";

const SORTS: IssueSort[] = ["newest", "oldest", "updated", "priority", "due"];

export interface IssueFilterState {
  q: string;
  status: IssueStatus | "";
  priority: IssuePriority | "";
  assignee: string;
  label: string;
  sort: IssueSort;
  page: number;
  view: BoardView;
}

export type BoardView = "list" | "board";

export const BOARD_PAGE_SIZE = 100;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function parseIssueFilters(params: RawParams): IssueFilterState {
  const status = first(params.status);
  const priority = first(params.priority);
  const sort = first(params.sort);
  const page = Math.floor(Number(first(params.page)));

  return {
    q: first(params.q).trim().slice(0, 100),
    status: ISSUE_STATUSES.includes(status as IssueStatus)
      ? (status as IssueStatus)
      : "",
    priority: ISSUE_PRIORITY_LIST.includes(priority as IssuePriority)
      ? (priority as IssuePriority)
      : "",
    assignee: first(params.assignee).slice(0, 64),
    label: first(params.label).slice(0, 64),
    sort: SORTS.includes(sort as IssueSort) ? (sort as IssueSort) : "newest",
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 1_000_000) : 1,
    view: first(params.view) === "board" ? "board" : "list",
  };
}

export function buildBoardQuery(
  filters: IssueFilterState,
  overrides: Partial<IssueFilterState> = {}
): string {
  const merged = { ...filters, ...overrides };
  const query = new URLSearchParams();

  if (merged.q) query.set("q", merged.q);
  if (merged.status) query.set("status", merged.status);
  if (merged.priority) query.set("priority", merged.priority);
  if (merged.assignee) query.set("assignee", merged.assignee);
  if (merged.label) query.set("label", merged.label);
  if (merged.sort !== "newest") query.set("sort", merged.sort);
  if (merged.page > 1) query.set("page", String(merged.page));
  if (merged.view === "board") query.set("view", "board");

  const text = query.toString();
  return text ? `?${text}` : "";
}

export function hasActiveFilters(filters: IssueFilterState): boolean {
  return Boolean(
    filters.q ||
      filters.status ||
      filters.priority ||
      filters.assignee ||
      filters.label ||
      filters.sort !== "newest"
  );
}
