"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/validation/project";
import { Dialog } from "@/components/dialog";

interface AvailableUser {
  id: string;
  username: string;
  name: string | null;
}

export function CreateProjectDialog({
  availableUsers,
}: {
  availableUsers: AvailableUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
  });

  function closeDialog() {
    setOpen(false);
    reset();
    setSelectedIds([]);
    setFormError(null);
  }

  function toggleMember(id: string) {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    );
  }

  async function onSubmit(data: CreateProjectInput) {
    setFormError(null);

    const res = await fetch("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name, memberIds: selectedIds }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setFormError(
        typeof body?.error === "string" ? body.error : "Something went wrong."
      );
      return;
    }

    const project = await res.json();
    closeDialog();
    router.push(`/${project.slug}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-foreground px-4 py-2 text-sm text-background"
      >
        + New project
      </button>

      <Dialog open={open} onClose={closeDialog} title="Create project">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="create-project-name" className="text-sm font-medium">
              Project name
            </label>
            <input
              id="create-project-name"
              type="text"
              placeholder="New project name"
              {...register("name")}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Assign people</span>
            {availableUsers.length === 0 ? (
              <p className="text-sm text-zinc-500">No other users yet.</p>
            ) : (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded border border-black/[.08] p-2 dark:border-white/[.145]">
                {availableUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => toggleMember(user.id)}
                    />
                    {user.username}
                    {user.name ? ` (${user.name})` : ""}
                  </label>
                ))}
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create project"}
            </button>
            <button
              type="button"
              onClick={closeDialog}
              className="rounded border border-black/[.08] px-4 py-2 dark:border-white/[.145]"
            >
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
