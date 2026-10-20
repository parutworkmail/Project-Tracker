"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IssueStatus } from "@/lib/projectSchema";

const STATUSES: IssueStatus[] = ["todo", "in_progress", "done"];

const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

interface IssueCardProps {
  slug: string;
  issue: {
    id: string;
    title: string;
    description: string | null;
    status: IssueStatus;
  };
}

export function IssueCard({ slug, issue }: IssueCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStatusChange(status: IssueStatus) {
    setLoading(true);

    await fetch(`/api/projects/${slug}/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="rounded border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black">
      <h3 className="font-medium">{issue.title}</h3>
      {issue.description && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {issue.description}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            disabled={loading || status === issue.status}
            className={`rounded px-2 py-1 text-xs ${
              status === issue.status
                ? "bg-foreground text-background"
                : "border border-black/[.08] dark:border-white/[.145]"
            } disabled:opacity-50`}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </div>
  );
}
