"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAppRouter } from "@/lib/useAppRouter";

import { PriorityBadge } from "@/components/issue-badges";
import { LabelChip } from "@/components/label-chip";
import { useToday } from "@/lib/useToday";
import {
  ISSUE_STATUSES,
  STATUS_LABELS,
  formatDueDate,
  isOverdue,
  type IssueLabelView,
  type IssuePriority,
  type IssueStatus,
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

const COLUMN_ACCENT: Record<IssueStatus, string> = {
  todo: "bg-stone-400",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
};

export function KanbanBoard({
  slug,
  issues,
  assigneeNames,
  total,
}: {
  slug: string;
  issues: Issue[];
  assigneeNames: Record<string, string>;
  total: number;
}) {
  const router = useAppRouter();
  const today = useToday();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<
    Record<string, { from: IssueStatus; to: IssueStatus }>
  >({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<IssueStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function shownStatus(issue: Issue): IssueStatus {
    const pending = optimistic[issue.id];
    return pending && pending.from === issue.status ? pending.to : issue.status;
  }

  function setPending(id: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function move(issue: Issue, to: IssueStatus) {
    if (pendingIds.has(issue.id) || shownStatus(issue) === to) return;

    setError(null);
    setOptimistic((prev) => ({
      ...prev,
      [issue.id]: { from: issue.status, to },
    }));
    setPending(issue.id, true);

    let ok = false;

    try {
      const res = await fetch(`/api/projects/${slug}/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });

      if (res.ok) {
        ok = true;
        startTransition(() => router.refresh());
      } else {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not move the task. Please try again."
        );
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(issue.id, false);

      if (!ok) {
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[issue.id];
          return next;
        });
      }
    }
  }

  const byId = new Map(issues.map((issue) => [issue.id, issue]));

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ISSUE_STATUSES.map((status) => {
          const cards = issues.filter((issue) => shownStatus(issue) === status);
          const isTarget = dragOver === status;

          return (
            <section
              key={status}
              aria-label={`${STATUS_LABELS[status]} column`}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== status) setDragOver(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragOver((current) => (current === status ? null : current));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                const issue = id ? byId.get(id) : undefined;
                setDragOver(null);
                setDraggingId(null);
                if (issue) void move(issue, status);
              }}
              className={`surface flex min-h-40 flex-col rounded-2xl p-3 transition-shadow ${
                isTarget ? "ring-2 ring-accent-strong" : ""
              }`}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full ${COLUMN_ACCENT[status]}`}
                  />
                  {STATUS_LABELS[status]}
                </h2>
                <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs text-muted dark:bg-white/[.1]">
                  {cards.length}
                </span>
              </header>

              <ul className="flex flex-1 flex-col gap-2">
                {cards.length === 0 && (
                  <li className="rounded-xl border border-dashed border-black/[.12] px-3 py-6 text-center text-xs text-zinc-500 dark:border-white/[.15]">
                    {isTarget ? "Drop here" : "No tasks"}
                  </li>
                )}

                {cards.map((issue) => {
                  const overdue = isOverdue(issue.due_date, status, today);

                  return (
                    <li
                      key={issue.id}
                      draggable
                      aria-busy={pendingIds.has(issue.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", issue.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(issue.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOver(null);
                      }}
                      className={`cursor-grab rounded-xl border border-black/[.08] bg-background/60 p-3 text-sm shadow-sm active:cursor-grabbing dark:border-white/[.12] ${
                        draggingId === issue.id ? "opacity-40" : ""
                      } ${pendingIds.has(issue.id) ? "opacity-70" : ""}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span>#{issue.number}</span>
                        <PriorityBadge priority={issue.priority} />
                      </div>

                      <Link
                        href={`/${slug}/board/${issue.id}`}
                        draggable={false}
                        className="line-clamp-2 break-words font-medium hover:underline"
                        title={issue.title}
                      >
                        {issue.title}
                      </Link>

                      {issue.labels.length > 0 && (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {issue.labels.map((label) => (
                            <LabelChip key={label.id} label={label} />
                          ))}
                        </span>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span className="truncate">
                          {issue.assignee_id
                            ? (assigneeNames[issue.assignee_id] ?? "Former member")
                            : "Unassigned"}
                        </span>
                        {issue.due_date && (
                          <span
                            className={
                              overdue
                                ? "whitespace-nowrap font-medium text-red-600"
                                : "whitespace-nowrap"
                            }
                          >
                            {formatDueDate(issue.due_date)}
                            {overdue && " · overdue"}
                          </span>
                        )}
                      </div>

                      <label className="mt-2 block">
                        <span className="sr-only">
                          Move {issue.title} to another column
                        </span>
                        <select
                          value={status}
                          disabled={pendingIds.has(issue.id)}
                          onChange={(e) =>
                            void move(issue, e.target.value as IssueStatus)
                          }
                          className="w-full rounded border border-black/[.08] bg-surface px-2 py-1 text-xs dark:border-white/[.145]"
                        >
                          {ISSUE_STATUSES.map((value) => (
                            <option key={value} value={value}>
                              {STATUS_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {total > issues.length && (
        <p className="mt-4 text-sm text-zinc-500">
          Showing the first {issues.length} of {total} tasks. Use the filters or
          the list view to find the rest.
        </p>
      )}
    </div>
  );
}
