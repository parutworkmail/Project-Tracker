export type IssueStatus = "todo" | "in_progress" | "done";
export type IssuePriority = "low" | "medium" | "high" | "urgent";
export type IssueSort = "newest" | "oldest" | "updated" | "priority" | "due";

export type LabelColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue";

export interface IssueLabelView {
  id: string;
  name: string;
  color: LabelColor;
}

export const LABEL_COLOR_LIST: LabelColor[] = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
];

export const LABEL_STYLES: Record<LabelColor, string> = {
  gray: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100",
  red: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100",
  yellow: "bg-yellow-200 text-yellow-950 dark:bg-yellow-400/25 dark:text-yellow-100",
  green: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100",
};

export const LABEL_DOT_STYLES: Record<LabelColor, string> = {
  gray: "bg-stone-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
};

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
    case "label":
      return to ? `added the label "${to}"` : `removed the label "${from ?? ""}"`;
    case "assignee_id":
      if (!to) return `unassigned ${nameOf(from)}`;
      if (!from) return `assigned this to ${nameOf(to)}`;
      return `reassigned this from ${nameOf(from)} to ${nameOf(to)}`;
    default:
      return "updated the task";
  }
}
