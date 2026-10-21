"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "SUPER_ADMIN" | "ADMIN" | "USER";

interface UserRow {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  role: Role;
}

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "USER"];

export function UserRoleManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function setPending(userId: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  }

  async function changeRole(userId: string, role: Role) {
    setPending(userId, true);
    setError(null);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "Role change failed."
      );
      setPending(userId, false);
      return;
    }

    setPending(userId, false);
    router.refresh();
  }

  async function deleteUser(userId: string, username: string) {
    if (
      !window.confirm(
        `Delete user "${username}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setPending(userId, true);
    setError(null);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "Delete failed."
      );
      setPending(userId, false);
      return;
    }

    setPending(userId, false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="py-2">Username</th>
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-t border-black/[.08] dark:border-white/[.145]"
            >
              <td className="py-2 font-medium">{user.username}</td>
              <td className="py-2">{user.name ?? "—"}</td>
              <td className="py-2">{user.email ?? "—"}</td>
              <td className="py-2">
                {user.id === currentUserId ? (
                  <span className="text-zinc-500">{user.role} (you)</span>
                ) : (
                  <select
                    value={user.role}
                    disabled={pendingIds.has(user.id)}
                    onChange={(e) =>
                      changeRole(user.id, e.target.value as Role)
                    }
                    className="rounded border border-black/[.08] bg-white px-2 py-1 dark:border-white/[.145] dark:bg-black"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td className="py-2 text-right">
                {user.id !== currentUserId && (
                  <button
                    type="button"
                    disabled={pendingIds.has(user.id)}
                    onClick={() => deleteUser(user.id, user.username)}
                    className="rounded border border-red-600 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
