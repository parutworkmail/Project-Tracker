"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PriorityBadge } from "@/components/issue-badges";
import { useToday } from "@/lib/useToday";
import {
  ISSUE_STATUSES,
  STATUS_LABELS,
  formatDueDate,
  isOverdue,
  type IssuePriority,
  type IssueStatus,
} from "@/lib/issueMeta";

interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  due_date: string | null;
  assignee_id: string | null;
}

export function IssueTable({
  slug,
  issues,
  assigneeNames,
  canManage,
  filtered,
}: {
  slug: string;
  issues: Issue[];
  assigneeNames: Record<string, string>;
  canManage: boolean;
  filtered: boolean;
}) {
  const router = useRouter();
  const today = useToday();
  const [, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<
    Record<string, { from: IssueStatus; to: IssueStatus }>
  >({});
  const [error, setError] = useState<string | null>(null);

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

  function handleDelete(issueId: string, title: string) {
    if (!window.confirm(`Delete task "${title}"? This cannot be undone.`)) {
      return;
    }

    return request(issueId, { method: "DELETE" });
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
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Assignee</th>
              <th className="px-3 py-2 font-medium">Due</th>
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
                  <td className="max-w-xs px-3 py-2 font-medium">
                    <Link
                      href={`/${slug}/board/${issue.id}`}
                      className="block truncate hover:underline"
                      title={issue.title}
                    >
                      {issue.title}
                    </Link>
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
