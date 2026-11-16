"use client";

import { useState } from "react";
import { useAppRouter, useNavigationBusy } from "@/lib/useAppRouter";
import { ActionButton } from "@/components/action-button";
import { useConfirm } from "@/components/confirm-provider";

export function LeaveProjectButton({
  slug,
  projectName,
  userId,
}: {
  slug: string;
  projectName: string;
  userId: string;
}) {
  const router = useAppRouter();
  const navigating = useNavigationBusy();
  const confirm = useConfirm();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave() {
    const ok = await confirm({
      title: "Leave project?",
      message: (
        <>
          Leave <strong>{projectName}</strong>? Your tasks will become unassigned
          and you will lose access unless someone adds you back.
        </>
      ),
      confirmLabel: "Leave project",
      tone: "danger",
    });

    if (!ok) return;

    setLeaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${slug}/members/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not leave the project."
        );
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <ActionButton
        onClick={handleLeave}
        pending={leaving || navigating}
        pendingLabel="Leaving…"
        className="rounded border border-black/[.08] px-3 py-1.5 text-sm text-zinc-600 hover:border-red-300 hover:text-red-600 dark:border-white/[.145] dark:text-zinc-400"
      >
        Leave project
      </ActionButton>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
