export type IssueStatus = "todo" | "in_progress" | "done";
export type IssuePriority = "low" | "medium" | "high" | "urgent";
export type IssueSort = "newest" | "oldest" | "updated" | "priority" | "due";

export const ISSUE_STATUSES: IssueStatus[] = ["todo", "in_progress", "done"];
export const ISSUE_PRIORITY_LIST: IssuePriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const SORT_LABELS: Record<IssueSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  updated: "Recently updated",
  priority: "Priority",
  due: "Due date",
};

export const STATUS_STYLES: Record<IssueStatus, string> = {
  todo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

export const PRIORITY_STYLES: Record<IssuePriority, string> = {
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function isOverdue(
  dueDate: string | null,
  status: IssueStatus,
  today: string
): boolean {
  if (!dueDate || !today || status === "done") return false;
  return dueDate < today;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "—";
  const [year, month, day] = dueDate.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function userLabel(user: {
  username: string;
  name: string | null;
}): string {
  return user.name ? `${user.name} (${user.username})` : user.username;
}

export interface ActivityLike {
  kind: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
}

function statusText(value: string | null): string {
  return value && value in STATUS_LABELS
    ? STATUS_LABELS[value as IssueStatus]
    : (value ?? "none");
}

function priorityText(value: string | null): string {
  return value && value in PRIORITY_LABELS
    ? PRIORITY_LABELS[value as IssuePriority]
    : (value ?? "none");
}

export function describeActivity(
  activity: ActivityLike,
  nameOf: (userId: string | null) => string
): string {
  if (activity.kind === "created") return "created this task";
  if (activity.kind === "commented") return "added a comment";

  const { old_value: from, new_value: to } = activity;

  switch (activity.field) {
    case "title":
      return `renamed the task from "${from ?? ""}" to "${to ?? ""}"`;
    case "description":
      return "updated the description";
    case "status":
      return `changed the status from ${statusText(from)} to ${statusText(to)}`;
    case "priority":
      return `changed the priority from ${priorityText(from)} to ${priorityText(to)}`;
    case "due_date":
      if (!to) return "cleared the due date";
      if (!from) return `set the due date to ${formatDueDate(to)}`;
      return `changed the due date from ${formatDueDate(from)} to ${formatDueDate(to)}`;
    case "assignee_id":
      if (!to) return `unassigned ${nameOf(from)}`;
      if (!from) return `assigned this to ${nameOf(to)}`;
      return `reassigned this from ${nameOf(from)} to ${nameOf(to)}`;
    default:
      return "updated the task";
  }
}
