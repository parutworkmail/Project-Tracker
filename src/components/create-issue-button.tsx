"use client";

import { useState } from "react";
import { useAppRouter } from "@/lib/useAppRouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Dialog } from "@/components/dialog";
import {
  ISSUE_PRIORITY_LIST,
  PRIORITY_LABELS,
  userLabel,
} from "@/lib/issueMeta";
import {
  createIssueSchema,
  type CreateIssueInput,
} from "@/lib/validation/project";

interface Assignee {
  id: string;
  username: string;
  name: string | null;
}

const FIELD =
  "rounded border border-black/[.08] bg-surface px-3 py-2 text-sm dark:border-white/[.145]";

export function CreateIssueButton({
  slug,
  assignees,
}: {
  slug: string;
  assignees: Assignee[];
}) {
  const router = useAppRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateIssueInput>({
    resolver: zodResolver(createIssueSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      assigneeId: "",
    },
  });

  function closeAndReset() {
    setOpen(false);
  }

  // Clear the form only after the dialog has faded out, so it does not blank mid-animation.
  function clearForm() {
    setFormError(null);
    reset();
  }

  function close() {
    if (isSubmitting) return;
    closeAndReset();
  }

  async function onCreate(data: CreateIssueInput) {
    setFormError(null);

    try {
      const res = await fetch(`/api/projects/${slug}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(
          typeof body?.error === "string"
            ? body.error
            : "Something went wrong. Please check the fields and try again."
        );
        return;
      }

      closeAndReset();
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background"
      >
        + Create task
      </button>

      <Dialog open={open} onClose={close} onExited={clearForm} title="Create task">
        <form
          onSubmit={handleSubmit(onCreate)}
          className="flex flex-col gap-3"
          noValidate
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="issue-title" className="text-sm font-medium">
              Title
            </label>
            <input
              id="issue-title"
              type="text"
              autoFocus
              maxLength={200}
              {...register("title")}
              className={FIELD}
            />
            {errors.title && (
              <p role="alert" className="text-sm text-red-600">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="issue-description" className="text-sm font-medium">
              Description <span className="text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="issue-description"
              rows={4}
              maxLength={2000}
              {...register("description")}
              className={FIELD}
            />
            {errors.description && (
              <p role="alert" className="text-sm text-red-600">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="issue-priority" className="text-sm font-medium">
                Priority
              </label>
              <select
                id="issue-priority"
                {...register("priority")}
                className={FIELD}
              >
                {ISSUE_PRIORITY_LIST.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="issue-due" className="text-sm font-medium">
                Due date
              </label>
              <input
                id="issue-due"
                type="date"
                {...register("dueDate")}
                className={FIELD}
              />
              {errors.dueDate && (
                <p role="alert" className="text-sm text-red-600">
                  {errors.dueDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="issue-assignee" className="text-sm font-medium">
              Assignee
            </label>
            <select
              id="issue-assignee"
              {...register("assigneeId")}
              className={FIELD}
            >
              <option value="">Unassigned</option>
              {assignees.map((user) => (
                <option key={user.id} value={user.id}>
                  {userLabel(user)}
                </option>
              ))}
            </select>
          </div>

          {formError && (
            <p role="alert" aria-live="polite" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {isSubmitting ? "Creating…" : "Create task"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
