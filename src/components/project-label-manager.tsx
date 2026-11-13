"use client";

import { useState } from "react";
import { useAppRouter } from "@/lib/useAppRouter";

import { LabelChip } from "@/components/label-chip";
import { useConfirm } from "@/components/confirm-provider";
import { LabelCreateForm } from "@/components/label-create-form";
import type { IssueLabelView } from "@/lib/issueMeta";

export function ProjectLabelManager({
  slug,
  labels,
}: {
  slug: string;
  labels: IssueLabelView[];
}) {
  const router = useAppRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function remove(label: IssueLabelView) {
    const ok = await confirm({
      title: "Delete label?",
      message: (
        <>
          Delete the label <strong>{label.name}</strong>? It is removed from
          every task.
        </>
      ),
      confirmLabel: "Delete label",
      tone: "danger",
    });

    if (!ok) return;

    setBusyId(label.id);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${slug}/labels/${label.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Could not delete the label.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {labels.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No labels yet. Create one below, then tag tasks with it.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <li key={label.id} className="flex items-center gap-1">
              <LabelChip label={label} />
              <button
                type="button"
                aria-label={`Delete label ${label.name}`}
                disabled={busyId === label.id}
                onClick={() => void remove(label)}
                className="rounded px-1 text-sm text-zinc-500 hover:text-red-600 disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <LabelCreateForm slug={slug} onCreated={() => router.refresh()} />
    </div>
  );
}
