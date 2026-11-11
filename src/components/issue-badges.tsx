import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  type IssuePriority,
  type IssueStatus,
} from "@/lib/issueMeta";

const BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`${BASE} ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  return (
    <span className={`${BASE} ${PRIORITY_STYLES[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
