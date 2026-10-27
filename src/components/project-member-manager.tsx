"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
}

export function ProjectMemberManager({
  slug,
  members,
}: {
  slug: string;
  members: Member[];
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;

    setIsAdding(true);
    setError(null);

    const res = await fetch(`/api/projects/${slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "Could not add member."
      );
      setIsAdding(false);
      return;
    }

    setUsername("");
    setIsAdding(false);
    router.refresh();
  }

  async function handleRemove(userId: string) {
    setPendingId(userId);
    setError(null);

    const res = await fetch(`/api/projects/${slug}/members/${userId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "Could not remove member."
      );
      setPendingId(null);
      return;
    }

    setPendingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {members.length === 0 ? (
        <p className="text-sm text-zinc-500">No members yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between rounded border border-black/[.08] bg-white px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black"
            >
              <span>
                {member.username}
                {member.name ? ` (${member.name})` : ""}
              </span>
              <button
                type="button"
                disabled={pendingId === member.id}
                onClick={() => handleRemove(member.id)}
                className="text-xs text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded border border-black/[.08] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black"
        />
        <button
          type="submit"
          disabled={isAdding || !username.trim()}
          className="rounded bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50"
        >
          {isAdding ? "Adding..." : "Add member"}
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
