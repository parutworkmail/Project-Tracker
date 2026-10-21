"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  updateProjectSchema,
  type UpdateProjectInput,
} from "@/lib/validation/project";

export function ProjectManageControls({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: { name },
  });

  async function onRename(data: UpdateProjectInput) {
    setError(null);

    const res = await fetch(`/api/projects/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "Rename failed."
      );
      return;
    }

    setIsEditing(false);
    router.refresh();
  }

  async function onDelete() {
    if (
      !window.confirm(
        `Delete "${name}"? This permanently removes the project and all its issues.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const res = await fetch(`/api/projects/${slug}`, { method: "DELETE" });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "Delete failed."
      );
      setIsDeleting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit(onRename)}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          {...register("name")}
          className="rounded border border-black/[.08] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-foreground px-2 py-1 text-xs text-background disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="rounded border border-black/[.08] px-2 py-1 text-xs dark:border-white/[.145]"
        >
          Cancel
        </button>
        {errors.name && (
          <span className="text-xs text-red-600">{errors.name.message}</span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="rounded border border-black/[.08] px-2 py-1 text-xs dark:border-white/[.145]"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="rounded border border-red-600 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
