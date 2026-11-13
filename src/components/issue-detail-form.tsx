"use client";

import { useState } from "react";
import { useAppRouter, useNavigationBusy } from "@/lib/useAppRouter";
import { ActionButton } from "@/components/action-button";
import { useConfirm } from "@/components/confirm-provider";

import { LabelChip } from "@/components/label-chip";
import { LabelCreateForm } from "@/components/label-create-form";
import {
  ISSUE_PRIORITY_LIST,
  ISSUE_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  userLabel,
  type IssueLabelView,
  type IssuePriority,
  type IssueStatus,
} from "@/lib/issueMeta";

interface Assignee {
  id: string;
  username: string;
  name: string | null;
}

interface IssueValues {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  due_date: string | null;
  assignee_id: string | null;
  labelIds: string[];
}

const FIELD =
  "rounded border border-black/[.08] bg-surface px-3 py-2 text-sm dark:border-white/[.145]";

export function IssueDetailForm({
  slug,
  issue,
  assignees,
  projectLabels,
  formerAssigneeLabel,
  canManage,
}: {
  slug: string;
  issue: IssueValues;
  assignees: Assignee[];
  projectLabels: IssueLabelView[];
  formerAssigneeLabel: string | null;
  canManage: boolean;
}) {
  const router = useAppRouter();
  const navigating = useNavigationBusy();
  const confirm = useConfirm();
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [status, setStatus] = useState<IssueStatus>(issue.status);
  const [priority, setPriority] = useState<IssuePriority>(issue.priority);
  const [dueDate, setDueDate] = useState(issue.due_date ?? "");
  const [assigneeId, setAssigneeId] = useState(issue.assignee_id ?? "");
  const [labelIds, setLabelIds] = useState<string[]>(issue.labelIds);
  const [availableLabels, setAvailableLabels] = useState(projectLabels);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setMessage(null);
      setter(value);
    };
  }

  const labelsChanged =
    labelIds.length !== issue.labelIds.length ||
    labelIds.some((id) => !issue.labelIds.includes(id));

  function toggleLabel(id: string) {
    setMessage(null);
    setLabelIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  const isDirty =
    labelsChanged ||
    title.trim() !== issue.title ||
    description !== (issue.description ?? "") ||
    status !== issue.status ||
    priority !== issue.priority ||
    dueDate !== (issue.due_date ?? "") ||
    assigneeId !== (issue.assignee_id ?? "");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!title.trim()) {
      setMessage({ kind: "error", text: "Title is required." });
      return;
    }

    const changes: Record<string, unknown> = {};
    if (title.trim() !== issue.title) changes.title = title.trim();
    if (description !== (issue.description ?? "")) changes.description = description;
    if (status !== issue.status) changes.status = status;
    if (priority !== issue.priority) changes.priority = priority;
    if (dueDate !== (issue.due_date ?? "")) changes.dueDate = dueDate;
    if (assigneeId !== (issue.assignee_id ?? "")) changes.assigneeId = assigneeId || null;
    if (labelsChanged) changes.labelIds = labelIds;

    setSaving(true);

    try {
      const res = await fetch(`/api/projects/${slug}/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage({
          kind: "error",
          text:
            typeof body?.error === "string"
              ? body.error
              : "Could not save. Please check the fields and try again.",
        });
        return;
      }

      setTitle(title.trim());
      setMessage({ kind: "ok", text: "Changes saved." });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete task?",
      message: (
        <>
          Delete <strong>{issue.title}</strong>? Its comments and history are
          removed too. This cannot be undone.
        </>
      ),
      confirmLabel: "Delete task",
      tone: "danger",
    });

    if (!ok) return;

    setSaving(true);

    try {
      const res = await fetch(`/api/projects/${slug}/issues/${issue.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage({
          kind: "error",
          text:
            typeof body?.error === "string"
              ? body.error
              : "Could not delete this task.",
        });
        return;
      }

      router.replace(`/${slug}/board`);
    } catch {
      setMessage({ kind: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const assigneeKnown =
    !issue.assignee_id || assignees.some((u) => u.id === issue.assignee_id);

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="detail-title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="detail-title"
          type="text"
          value={title}
          maxLength={200}
          onChange={(e) => edit(setTitle)(e.target.value)}
          className={`${FIELD} text-base font-medium`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="detail-description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="detail-description"
          rows={6}
          maxLength={2000}
          value={description}
          onChange={(e) => edit(setDescription)(e.target.value)}
          placeholder="Add more detail…"
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="detail-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="detail-status"
            value={status}
            onChange={(e) => edit(setStatus)(e.target.value as IssueStatus)}
            className={FIELD}
          >
            {ISSUE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="detail-priority" className="text-sm font-medium">
            Priority
          </label>
          <select
            id="detail-priority"
            value={priority}
            onChange={(e) => edit(setPriority)(e.target.value as IssuePriority)}
            className={FIELD}
          >
            {ISSUE_PRIORITY_LIST.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="detail-assignee" className="text-sm font-medium">
            Assignee
          </label>
          <select
            id="detail-assignee"
            value={assigneeId}
            onChange={(e) => edit(setAssigneeId)(e.target.value)}
            className={FIELD}
          >
            <option value="">Unassigned</option>
            {!assigneeKnown && issue.assignee_id && (
              <option value={issue.assignee_id}>
                {formerAssigneeLabel ?? "Former member"} (no longer on project)
              </option>
            )}
            {assignees.map((user) => (
              <option key={user.id} value={user.id}>
                {userLabel(user)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="detail-due" className="text-sm font-medium">
            Due date
          </label>
          <div className="flex gap-2">
            <input
              id="detail-due"
              type="date"
              value={dueDate}
              onChange={(e) => edit(setDueDate)(e.target.value)}
              className={`${FIELD} flex-1`}
            />
            {dueDate && (
              <button
                type="button"
                onClick={() => setDueDate("")}
                className="text-sm text-zinc-500 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Labels</legend>
        {availableLabels.length === 0 ? (
          <p className="text-sm text-zinc-500">
            This project has no labels yet. Create the first one below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableLabels.map((label) => {
              const selected = labelIds.includes(label.id);

              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleLabel(label.id)}
                  className={`rounded-full ${
                    selected
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-[var(--background)]"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <LabelChip label={label} />
                </button>
              );
            })}
          </div>
        )}
        <LabelCreateForm
          slug={slug}
          onCreated={(label) => {
            setAvailableLabels((prev) => [...prev, label]);
            setLabelIds((prev) => [...prev, label.id]);
            setMessage(null);
          }}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          type="submit"
          pending={saving || navigating}
          pendingLabel="Saving…"
          disabled={!isDirty}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Save changes
        </ActionButton>

        {canManage && (
          <ActionButton
            onClick={handleDelete}
            pending={navigating}
            pendingLabel="Deleting…"
            disabled={saving}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 dark:border-red-900"
          >
            Delete task
          </ActionButton>
        )}

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={
              message.kind === "error"
                ? "text-sm text-red-600"
                : "text-sm text-green-600"
            }
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
