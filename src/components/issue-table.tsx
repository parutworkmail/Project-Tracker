"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { IssueStatus } from "@/lib/projectSchema";

const STATUSES: IssueStatus[] = ["todo", "in_progress", "done"];

const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
}

export function IssueTable({
  slug,
  issues,
  canManage,
}: {
  slug: string;
  issues: Issue[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleStatusChange(issueId: string, status: IssueStatus) {
    setPendingId(issueId);

    await fetch(`/api/projects/${slug}/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setPendingId(null);
    router.refresh();
  }

  async function handleDelete(issueId: string, title: string) {
    if (!window.confirm(`Delete task "${title}"? This cannot be undone.`)) {
      return;
    }

    setPendingId(issueId);

    await fetch(`/api/projects/${slug}/issues/${issueId}`, {
      method: "DELETE",
    });

    setPendingId(null);
    router.refresh();
  }

  if (issues.length === 0) {
    return <p className="text-zinc-500">No issues yet.</p>;
  }

  return (
    <table className="w-full border-collapse overflow-hidden rounded border border-black/[.08] text-sm dark:border-white/[.145]">
      <thead>
        <tr className="border-b border-black/[.08] bg-black/[.03] text-left dark:border-white/[.145] dark:bg-white/[.06]">
          <th className="px-3 py-2 font-medium">Title</th>
          <th className="px-3 py-2 font-medium">Description</th>
          <th className="px-3 py-2 font-medium">Status</th>
          {canManage && <th className="px-3 py-2 font-medium"></th>}
        </tr>
      </thead>
      <tbody>
        {issues.map((issue) => (
          <tr
            key={issue.id}
            className="border-b border-black/[.08] bg-white last:border-b-0 dark:border-white/[.145] dark:bg-black"
          >
            <td className="px-3 py-2 font-medium">{issue.title}</td>
            <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
              {issue.description ?? "—"}
            </td>
            <td className="px-3 py-2">
              <select
                value={issue.status}
                disabled={pendingId === issue.id}
                onChange={(e) =>
                  handleStatusChange(issue.id, e.target.value as IssueStatus)
                }
                className="rounded border border-black/[.08] bg-white px-2 py-1 text-xs dark:border-white/[.145] dark:bg-black"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </td>
            {canManage && (
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  disabled={pendingId === issue.id}
                  onClick={() => handleDelete(issue.id, issue.title)}
                  className="text-xs text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
