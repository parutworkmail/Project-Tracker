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
  currentUserId,
}: {
  slug: string;
  members: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setPending(userId: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${slug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not add member."
        );
        return;
      }

      setUsername("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove(member: Member) {
    const isSelf = member.id === currentUserId;
    const label = member.name || member.username;

    const message = isSelf
      ? "Remove yourself from this project? Your tasks will become unassigned."
      : `Remove ${label} from this project? Their tasks will become unassigned.`;

    if (!window.confirm(message)) return;

    setPending(member.id, true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${slug}/members/${member.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not remove member."
        );
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(member.id, false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {members.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No members yet. Add people by username below.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between rounded border border-black/[.08] bg-surface px-3 py-2 text-sm dark:border-white/[.145]"
            >
              <span>
                {member.username}
                {member.name ? ` (${member.name})` : ""}
                {member.id === currentUserId && (
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    you
                  </span>
                )}
              </span>
              <button
                type="button"
                disabled={pendingIds.has(member.id)}
                aria-label={`Remove ${member.username}`}
                onClick={() => handleRemove(member)}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <label htmlFor="add-member" className="sr-only">
          Username to add
        </label>
        <input
          id="add-member"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded border border-black/[.08] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-surface"
        />
        <button
          type="submit"
          disabled={isAdding || !username.trim()}
          className="rounded bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50"
        >
          {isAdding ? "Adding…" : "Add member"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
