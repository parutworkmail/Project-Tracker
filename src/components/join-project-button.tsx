"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinProjectButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/projects/${slug}/join`, { method: "POST" });

    setLoading(false);

    if (!res.ok) {
      setError("Could not join this project.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-zinc-600 dark:text-zinc-400">
        You are not a member of this project yet.
      </p>
      <button
        onClick={handleJoin}
        disabled={loading}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {loading ? "Joining..." : "Join project"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
