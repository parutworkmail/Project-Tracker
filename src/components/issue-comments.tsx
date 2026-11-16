"use client";

import { useRef, useState } from "react";
import { useAppRouter } from "@/lib/useAppRouter";

import { LocalTime } from "@/components/local-time";
import { useConfirm } from "@/components/confirm-provider";
import { splitMentions, type MentionUser } from "@/lib/mentions";

interface CommentView {
  id: string;
  authorId: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}

const OPEN_MENTION = /(?<![\w@.-])@([a-zA-Z0-9_.-]{0,32})$/;
const MAX_SUGGESTIONS = 6;

export function IssueComments({
  slug,
  issueId,
  comments,
  currentUserId,
  canManage,
  people,
}: {
  slug: string;
  issueId: string;
  comments: CommentView[];
  currentUserId: string;
  canManage: boolean;
  people: MentionUser[];
}) {
  const router = useAppRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const confirm = useConfirm();

  const base = `/api/projects/${slug}/issues/${issueId}/comments`;

  const matches = suggest
    ? people
        .filter((user) =>
          `${user.username} ${user.name ?? ""}`
            .toLowerCase()
            .includes(suggest.query.toLowerCase())
        )
        .sort((a, b) => {
          const query = suggest.query.toLowerCase();
          const aStarts = a.username.toLowerCase().startsWith(query) ? 0 : 1;
          const bStarts = b.username.toLowerCase().startsWith(query) ? 0 : 1;
          return aStarts - bStarts || a.username.localeCompare(b.username);
        })
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const open = matches.length > 0;

  // Opens the people list while the cursor sits right after "@something".
  function updateSuggest(value: string, caret: number) {
    const found = OPEN_MENTION.exec(value.slice(0, caret));
    setSuggest(found ? { start: caret - found[0].length, query: found[1] } : null);
    setActive(0);
  }

  function pick(user: MentionUser) {
    const textarea = textareaRef.current;
    if (!suggest || !textarea) return;

    const caret = textarea.selectionStart;
    const before = body.slice(0, suggest.start);
    const inserted = `@${user.username} `;
    const position = before.length + inserted.length;

    setBody(before + inserted + body.slice(caret));
    setSuggest(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(position, position);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((index) => (index + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((index) => (index - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(matches[active] ?? matches[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSuggest(null);
    }
  }

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
        <div className="relative">
          <textarea
            ref={textareaRef}
            id="new-comment"
            rows={2}
            maxLength={2000}
            value={body}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="mention-list"
            aria-activedescendant={open ? `mention-option-${active}` : undefined}
            onChange={(e) => {
              setBody(e.target.value);
              updateSuggest(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => setSuggest(null)}
            placeholder="Add a comment… type @ to tag someone"
            className="w-full rounded border border-black/[.08] bg-surface px-3 py-2 text-sm dark:border-white/[.145]"
          />
          {open && (
            <ul
              id="mention-list"
              role="listbox"
              aria-label="People you can tag"
              className="absolute left-0 top-full z-20 mt-1 max-h-56 w-72 max-w-full overflow-y-auto rounded-lg border border-black/[.08] bg-surface py-1 shadow-lg dark:border-white/[.145]"
            >
              {matches.map((user, index) => (
                <li
                  key={user.id}
                  id={`mention-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(user);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={`cursor-pointer px-3 py-1.5 text-sm ${
                    index === active ? "bg-accent/25" : ""
                  }`}
                >
                  <span className="font-medium">{user.name ?? user.username}</span>
                  {user.name && (
                    <span className="ml-2 text-xs text-zinc-500">@{user.username}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
                {splitMentions(comment.body, people).map((part, index) =>
                  part.user ? (
                    <span
                      key={index}
                      title={part.user.name ?? part.user.username}
                      className="rounded bg-accent/30 px-1 font-medium"
                    >
                      {part.text}
                    </span>
                  ) : (
                    <span key={index}>{part.text}</span>
                  )
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
