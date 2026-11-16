"use client";

import { useState } from "react";
import { useAppRouter } from "@/lib/useAppRouter";

import {
  EditUserDialog,
  ResetPasswordDialog,
} from "@/components/admin/user-edit-dialogs";
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog";

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
  const router = useAppRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // The dialogs stay mounted while they fade out, so the user is kept apart from
  // the open flag; the sequence number gives every opening a fresh form.
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSeq, setEditSeq] = useState(0);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSeq, setResetSeq] = useState(0);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSeq, setDeleteSeq] = useState(0);

  function openEditor(user: UserRow) {
    setEditing(user);
    setEditSeq((n) => n + 1);
    setEditOpen(true);
  }

  function openReset(user: UserRow) {
    setResetting(user);
    setResetSeq((n) => n + 1);
    setResetOpen(true);
  }

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

  function openDelete(user: UserRow) {
    setDeleting(user);
    setDeleteSeq((n) => n + 1);
    setDeleteOpen(true);
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="py-2 pr-4">Username</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-t border-black/[.08] dark:border-white/[.145]"
            >
              <td className="py-2 pr-4 font-medium">{user.username}</td>
              <td className="py-2 pr-4">{user.name ?? "—"}</td>
              <td className="py-2 pr-4 break-all">{user.email ?? "—"}</td>
              <td className="py-2 pr-4">
                {user.id === currentUserId ? (
                  <span className="text-zinc-500">{user.role} (you)</span>
                ) : (
                  <select
                    aria-label={`Role of ${user.username}`}
                    value={user.role}
                    disabled={pendingIds.has(user.id)}
                    onChange={(e) =>
                      changeRole(user.id, e.target.value as Role)
                    }
                    className="rounded border border-black/[.08] bg-surface px-2 py-1 dark:border-white/[.145]"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td className="py-2 text-right whitespace-nowrap">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label={`Edit ${user.username}`}
                    onClick={() => openEditor(user)}
                    className="rounded border border-black/[.08] px-2 py-1 text-xs dark:border-white/[.145]"
                  >
                    Edit
                  </button>
                  {user.id !== currentUserId && (
                    <>
                      <button
                        type="button"
                        aria-label={`Reset password for ${user.username}`}
                        onClick={() => openReset(user)}
                        className="rounded border border-black/[.08] px-2 py-1 text-xs dark:border-white/[.145]"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        disabled={pendingIds.has(user.id)}
                        aria-label={`Delete ${user.username}`}
                        onClick={() => openDelete(user)}
                        className="rounded border border-red-600 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {editing && (
        <EditUserDialog
          key={editSeq}
          open={editOpen}
          user={editing}
          onClose={() => setEditOpen(false)}
        />
      )}
      {resetting && (
        <ResetPasswordDialog
          key={resetSeq}
          open={resetOpen}
          user={resetting}
          onClose={() => setResetOpen(false)}
        />
      )}
      {deleting && (
        <DeleteUserDialog
          key={deleteSeq}
          open={deleteOpen}
          user={deleting}
          onClose={() => setDeleteOpen(false)}
          onExited={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
