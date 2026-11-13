"use client";

import { useState } from "react";

import { ActionButton } from "@/components/action-button";
import { Dialog } from "@/components/dialog";
import { useAppRouter } from "@/lib/useAppRouter";

interface DeletableUser {
  id: string;
  username: string;
  name: string | null;
}

export function DeleteUserDialog({
  open,
  user,
  onClose,
  onExited,
}: {
  open: boolean;
  user: DeletableUser;
  onClose: () => void;
  onExited?: () => void;
}) {
  const router = useAppRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (deleting) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not delete the user. Please try again."
        );
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={deleting ? () => {} : onClose}
      onExited={onExited}
      title="Delete user"
      hideClose
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          This permanently deletes the account{" "}
          <strong className="break-words">{user.username}</strong>
          {user.name ? ` (${user.name})` : ""}. They will no longer be able to log
          in, and they are removed from every project they belong to. This
          cannot be undone.
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="btn-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <ActionButton
            onClick={handleDelete}
            pending={deleting}
            pendingLabel="Deleting..."
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete user
          </ActionButton>
        </div>
      </div>
    </Dialog>
  );
}
