"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeaveProjectButton({
  slug,
  projectName,
  userId,
}: {
  slug: string;
  projectName: string;
  userId: string;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave() {
    if (
      !window.confirm(
        `Leave "${projectName}"? Your tasks will become unassigned and you will lose access unless someone adds you back.`
      )
    ) {
      return;
    }

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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleLeave}
        disabled={leaving}
        className="rounded border border-black/[.08] px-3 py-1.5 text-sm text-zinc-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-400"
      >
        {leaving ? "Leaving…" : "Leave project"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
