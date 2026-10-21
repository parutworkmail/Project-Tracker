"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "SUPER_ADMIN" | "ADMIN" | "USER";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(userId: string, role: Role) {
    setPendingId(userId);
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
      setPendingId(null);
      return;
    }

    setPendingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-t border-black/[.08] dark:border-white/[.145]"
            >
              <td className="py-2">{user.name ?? "—"}</td>
              <td className="py-2">{user.email}</td>
              <td className="py-2">
                {user.id === currentUserId ? (
                  <span className="text-zinc-500">{user.role} (you)</span>
                ) : (
                  <select
                    value={user.role}
                    disabled={pendingId === user.id}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
