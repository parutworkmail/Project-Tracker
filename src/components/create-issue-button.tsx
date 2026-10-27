"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createIssueSchema,
  type CreateIssueInput,
} from "@/lib/validation/project";

export function CreateIssueButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateIssueInput>({
    resolver: zodResolver(createIssueSchema),
  });

  async function onCreate(data: CreateIssueInput) {
    setFormError(null);

    const res = await fetch(`/api/projects/${slug}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setFormError(
        typeof body?.error === "string" ? body.error : "Something went wrong."
      );
      return;
    }

    reset();
    setIsCreating(false);
    router.refresh();
  }

  if (!isCreating) {
    return (
      <button
        type="button"
        onClick={() => setIsCreating(true)}
        className="rounded bg-foreground px-3 py-1 text-sm text-background"
      >
        + Create issue
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onCreate)}
      className="flex w-80 flex-col gap-2 rounded border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black"
    >
      <div className="flex flex-col gap-1">
        <input
          type="text"
          placeholder="Issue title"
          {...register("title")}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {errors.title && (
          <p className="text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <textarea
          placeholder="Description (optional)"
          {...register("description")}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {errors.description && (
          <p className="text-sm text-red-600">
            {errors.description.message}
          </p>
        )}
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-fit rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {isSubmitting ? "Adding..." : "Add issue"}
        </button>
        <button
          type="button"
          onClick={() => setIsCreating(false)}
          className="w-fit rounded border border-black/[.08] px-4 py-2 dark:border-white/[.145]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
