"use client";

import { useState } from "react";
import { useAppRouter } from "@/lib/useAppRouter";

import { LocalTime } from "@/components/local-time";
import { useConfirm } from "@/components/confirm-provider";

interface CommentView {
  id: string;
  authorId: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}

export function IssueComments({
  slug,
  issueId,
  comments,
  currentUserId,
  canManage,
}: {
  slug: string;
  issueId: string;
  comments: CommentView[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useAppRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const confirm = useConfirm();

  const base = `/api/projects/${slug}/issues/${issueId}/comments`;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!body.trim()) {
      setError("Write something before posting.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Could not post your comment."
        );
        return;
      }

      setBody("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    const ok = await confirm({
      title: "Delete comment?",
      message: "This comment will be removed for everyone. This cannot be undone.",
      confirmLabel: "Delete comment",
      tone: "danger",
    });

    if (!ok) return;

    setDeletingId(commentId);
    setError(null);

    try {
      const res = await fetch(`${base}/${commentId}`, { method: "DELETE" });

      if (!res.ok) {
        setError("Could not delete the comment.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="sr-only">
        Comments ({comments.length})
      </h2>

      <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2" noValidate>
        <label htmlFor="new-comment" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="new-comment"
          rows={2}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          className="rounded border border-black/[.08] bg-surface px-3 py-2 text-sm dark:border-white/[.145]"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {submitting ? "Posting…" : "Post comment"}
        </button>
      </form>

      {comments.length === 0 ? (
        <p className="text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded border border-black/[.08] bg-surface p-3 dark:border-white/[.145]"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  <span className="font-medium text-foreground">
                    {comment.authorLabel}
                  </span>
                  {" · "}
                  <LocalTime iso={comment.createdAt} />
                </span>
                {(canManage || comment.authorId === currentUserId) && (
                  <button
                    type="button"
                    aria-label={`Delete comment by ${comment.authorLabel}`}
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
