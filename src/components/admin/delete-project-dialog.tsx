"use client";

import { useState } from "react";

import { ActionButton } from "@/components/action-button";
import { Dialog } from "@/components/dialog";
import { useAppRouter } from "@/lib/useAppRouter";

interface DeletableProject {
  name: string;
  slug: string;
  memberCount: number;
}

// Must stay in step with the server check: exact name, spaces around it ignored.
export function nameMatches(typed: string, projectName: string): boolean {
  return typed.trim() === projectName;
}

export function DeleteProjectDialog({
  open,
  project,
  onClose,
  onExited,
}: {
  open: boolean;
  project: DeletableProject;
  onClose: () => void;
  onExited?: () => void;
}) {
  const router = useAppRouter();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = nameMatches(typed, project.name);

  async function handleDelete(event?: React.FormEvent) {
    event?.preventDefault();

    if (!matches || deleting) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/projects/${project.slug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: typed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not delete the project. Please try again."
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
      title="Delete project"
      hideClose
    >
      <form onSubmit={handleDelete} className="flex flex-col gap-4" noValidate>
        <p className="text-sm">
          This permanently deletes{" "}
          <strong className="break-words">{project.name}</strong>, including all
          of its tasks, comments and labels, and removes its{" "}
          {project.memberCount} {project.memberCount === 1 ? "member" : "members"}.
          This cannot be undone.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="delete-project-name" className="text-sm font-medium">
            Type{" "}
            <span className="select-all rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-xs dark:bg-white/[.1]">
              {project.name}
            </span>{" "}
            to confirm
          </label>
          <input
            id="delete-project-name"
            type="text"
            value={typed}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => {
              setTyped(e.target.value);
              setError(null);
            }}
            aria-invalid={typed.length > 0 && !matches}
            className="rounded border border-black/[.08] bg-surface px-3 py-2 text-sm dark:border-white/[.145]"
          />
          {typed.length > 0 && !matches && (
            <p className="text-xs text-muted">
              The name must match exactly, including capital letters.
            </p>
          )}
        </div>

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
            type="submit"
            pending={deleting}
            pendingLabel="Deleting..."
            disabled={!matches}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete project
          </ActionButton>
        </div>
      </form>
    </Dialog>
  );
}
