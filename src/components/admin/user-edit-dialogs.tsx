"use client";

import { useState } from "react";
import { useAppRouter } from "@/lib/useAppRouter";

import { Dialog } from "@/components/dialog";
import { PasswordInput } from "@/components/password-input";

interface EditableUser {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
}

const FIELD =
  "rounded border border-black/[.08] bg-surface px-3 py-2 text-sm dark:border-white/[.145]";

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export function EditUserDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: EditableUser;
  onClose: () => void;
}) {
  const router = useAppRouter();
  const [username, setUsername] = useState(user.username);
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const changes: Record<string, string> = {};
    if (username.trim() !== user.username) changes.username = username.trim();
    if (name.trim() !== (user.name ?? "")) changes.name = name;
    if (email.trim() !== (user.email ?? "")) changes.email = email;

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (!res.ok) {
        setError(await readError(res, "Could not save changes."));
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? () => {} : onClose}
      title={`Edit ${user.username}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-username" className="text-sm font-medium">
            Username
          </label>
          <input
            id="edit-username"
            type="text"
            value={username}
            maxLength={32}
            onChange={(e) => setUsername(e.target.value)}
            className={FIELD}
          />
          <p className="text-xs text-zinc-500">
            The user must use the new username the next time they sign in.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-name" className="text-sm font-medium">
            Name <span className="text-zinc-500">(optional)</span>
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-email" className="text-sm font-medium">
            Email <span className="text-zinc-500">(optional)</span>
          </label>
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function ResetPasswordDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: EditableUser;
  onClose: () => void;
}) {
  const router = useAppRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError(await readError(res, "Could not reset the password."));
        return;
      }

      setDone(true);
      setPassword("");
      setConfirm("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? () => {} : onClose}
      title={`Reset password for ${user.username}`}
    >
      {done ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm text-green-600">
            Password reset. Share the temporary password with {user.username}{" "}
            privately. They will be asked to choose a new one when they sign
            in, and any lockout has been cleared.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <p className="text-sm text-zinc-500">
            Set a temporary password. The user must change it on their next
            sign-in.
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor="reset-password" className="text-sm font-medium">
              Temporary password
            </label>
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="reset-confirm" className="text-sm font-medium">
              Confirm password
            </label>
            <PasswordInput
              id="reset-confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={FIELD}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {saving ? "Resetting…" : "Reset password"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
