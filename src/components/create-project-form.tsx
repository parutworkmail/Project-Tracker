"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/validation/project";

export function CreateProjectForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
  });

  async function onSubmit(data: CreateProjectInput) {
    setFormError(null);

    const res = await fetch("/api/projects", {
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

    const project = await res.json();
    reset();
    router.push(`/${project.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <input
          type="text"
          placeholder="New project name"
          {...register("name")}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-fit rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {isSubmitting ? "Creating..." : "Create project"}
      </button>
    </form>
  );
}
