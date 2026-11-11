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
