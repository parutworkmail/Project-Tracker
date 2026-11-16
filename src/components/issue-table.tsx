"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useAppRouter } from "@/lib/useAppRouter";

import { PriorityBadge } from "@/components/issue-badges";
import { LabelChip } from "@/components/label-chip";
import { useConfirm } from "@/components/confirm-provider";
import { useToday } from "@/lib/useToday";
import { buildBoardQuery, type IssueFilterState } from "@/lib/issueFilters";
import {
  ISSUE_STATUSES,
  SORT_COLUMNS,
  STATUS_LABELS,
  formatDueDate,
  isOverdue,
  sortColumnState,
  type IssueLabelView,
  type IssuePriority,
  type IssueStatus,
  type SortColumn,
} from "@/lib/issueMeta";

interface Issue {
  id: string;
  number: number;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  due_date: string | null;
  assignee_id: string | null;
  labels: IssueLabelView[];
}

// A column header that sorts the table: click once for the first order, again to
// reverse it. It is a plain link, so the sort lives in the URL and paging keeps it.
function SortHeader({
  slug,
  filters,
  column,
  className = "",
  children,
}: {
  slug: string;
  filters: IssueFilterState;
  column: SortColumn;
  className?: string;
  children: ReactNode;
}) {
  const state = sortColumnState(filters.sort, column);
  const { first, second } = SORT_COLUMNS[column];
  const next = state === "first" ? second : first;
  const label = `Sort by ${String(children).toLowerCase()}`;

  return (
    <th
      scope="col"
      aria-sort={
        state === "first" ? "ascending" : state === "second" ? "descending" : "none"
      }
      className={`px-3 py-2 font-medium ${className}`}
    >
      <Link
        href={`/${slug}/board${buildBoardQuery(filters, { sort: next, page: 1 })}`}
        aria-label={label}
        className={`inline-flex items-center gap-1 uppercase hover:text-foreground ${
          state ? "text-foreground" : ""
        }`}
      >
        {children}
        <span aria-hidden="true" className={state ? "" : "opacity-30"}>
          {state === "first" ? "▲" : state === "second" ? "▼" : "⇅"}
        </span>
      </Link>
    </th>
  );
}

export function IssueTable({
  slug,
  issues,
  assigneeNames,
  canManage,
  filtered,
  filters,
}: {
  slug: string;
  issues: Issue[];
  assigneeNames: Record<string, string>;
  canManage: boolean;
  filtered: boolean;
  filters: IssueFilterState;
}) {
  const router = useAppRouter();
  const today = useToday();
  const [, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<
    Record<string, { from: IssueStatus; to: IssueStatus }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  function setPending(issueId: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(issueId);
      else next.delete(issueId);
      return next;
    });
  }

  async function request(issueId: string, init: RequestInit): Promise<boolean> {
    setPending(issueId, true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${slug}/issues/${issueId}`, init);

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Something went wrong. Please try again."
        );
        return false;
      }

      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setPending(issueId, false);
    }
  }

  async function handleStatusChange(issue: Issue, status: IssueStatus) {
    if (pendingIds.has(issue.id)) return;

    setOptimistic((prev) => ({
      ...prev,
      [issue.id]: { from: issue.status, to: status },
    }));

    const ok = await request(issue.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!ok) {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[issue.id];
        return next;
      });
    }
  }

  async function handleDelete(issueId: string, title: string) {
    const ok = await confirm({
      title: "Delete task?",
      message: (
        <>
          Delete <strong>{title}</strong>? Its comments and history are removed
          too. This cannot be undone.
        </>
      ),
      confirmLabel: "Delete task",
      tone: "danger",
    });

    if (!ok) return;

    await request(issueId, { method: "DELETE" });
  }

  if (issues.length === 0) {
    return (
      <div className="surface animate-fade-up rounded-2xl border-dashed px-6 py-14 text-center">
        <p className="font-medium">
          {filtered ? "No tasks match your filters." : "No tasks yet."}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {filtered
            ? "Try a different search or clear the filters."
            : "Use “+ Create task” to add the first one."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="surface animate-fade-up overflow-x-auto rounded-2xl">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/[.06] bg-accent/[.08] text-left text-xs uppercase tracking-wide text-muted dark:border-white/[.08] dark:bg-accent/[.08]">
              <SortHeader slug={slug} filters={filters} column="number" className="w-14">
                #
              </SortHeader>
              <SortHeader slug={slug} filters={filters} column="title">
                Title
              </SortHeader>
              <SortHeader slug={slug} filters={filters} column="status">
                Status
              </SortHeader>
              <SortHeader slug={slug} filters={filters} column="priority">
                Priority
              </SortHeader>
              <SortHeader slug={slug} filters={filters} column="assignee">
                Assignee
              </SortHeader>
              <SortHeader slug={slug} filters={filters} column="due">
                Due
              </SortHeader>
              {canManage && (
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => {
              const pending = optimistic[issue.id];
              const shownStatus =
                pending && pending.from === issue.status
                  ? pending.to
                  : issue.status;
              const overdue = isOverdue(issue.due_date, shownStatus, today);

              return (
                <tr
                  key={issue.id}
                  aria-busy={pendingIds.has(issue.id)}
                  style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  className="animate-fade-in border-b border-black/[.06] last:border-b-0 hover:bg-accent/[.08] dark:border-white/[.08] dark:hover:bg-accent/[.08]"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                    #{issue.number}
                  </td>
                  <td className="max-w-xs px-3 py-2 font-medium">
                    <Link
                      href={`/${slug}/board/${issue.id}`}
                      className="block truncate hover:underline"
                      title={issue.title}
                    >
                      {issue.title}
                    </Link>
                    {issue.labels.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {issue.labels.map((label) => (
                          <LabelChip key={label.id} label={label} />
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={shownStatus}
                      aria-label={`Status of ${issue.title}`}
                      onChange={(e) =>
                        handleStatusChange(issue, e.target.value as IssueStatus)
                      }
                      className="rounded border border-black/[.08] bg-surface px-2 py-1 text-xs dark:border-white/[.145]"
                    >
                      {ISSUE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <PriorityBadge priority={issue.priority} />
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {issue.assignee_id
                      ? (assigneeNames[issue.assignee_id] ?? "Former member")
                      : "Unassigned"}
                  </td>
                  <td
                    className={
                      overdue
                        ? "whitespace-nowrap px-3 py-2 font-medium text-red-600"
                        : "whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400"
                    }
                  >
                    {formatDueDate(issue.due_date)}
                    {overdue && <span className="ml-1 text-xs">overdue</span>}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={pendingIds.has(issue.id)}
                        aria-label={`Delete ${issue.title}`}
                        onClick={() => handleDelete(issue.id, issue.title)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
