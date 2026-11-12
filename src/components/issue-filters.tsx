"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ISSUE_PRIORITY_LIST,
  ISSUE_STATUSES,
  PRIORITY_LABELS,
  SORT_LABELS,
  STATUS_LABELS,
  userLabel,
  type IssueLabelView,
  type IssueSort,
} from "@/lib/issueMeta";
import {
  buildBoardQuery,
  hasActiveFilters,
  type IssueFilterState,
} from "@/lib/issueFilters";

interface Assignee {
  id: string;
  username: string;
  name: string | null;
}

const CONTROL =
  "rounded border border-black/[.08] bg-surface px-2 py-1.5 text-sm dark:border-white/[.145]";

export function IssueFilters({
  slug,
  filters,
  assignees,
  labels,
}: {
  slug: string;
  filters: IssueFilterState;
  assignees: Assignee[];
  labels: IssueLabelView[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.q);
  const [lastPushed, setLastPushed] = useState(filters.q);
  const [seenQ, setSeenQ] = useState(filters.q);

  // Follow URL changes that did not come from typing (Back/Forward).
  if (filters.q !== seenQ) {
    setSeenQ(filters.q);
    if (filters.q !== lastPushed) {
      setSearch(filters.q);
      setLastPushed(filters.q);
    }
  }

  function navigate(overrides: Partial<IssueFilterState>) {
    const query = buildBoardQuery(filters, { page: 1, ...overrides });
    router.push(`/${slug}/board${query}`);
  }

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === lastPushed) return;

    const handle = setTimeout(() => {
      setLastPushed(trimmed);
      const query = buildBoardQuery(filters, { q: trimmed, page: 1 });
      router.replace(`/${slug}/board${query}`, { scroll: false });
    }, 300);

    return () => clearTimeout(handle);
  }, [search, lastPushed, filters, slug, router]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tasks…"
        aria-label="Search tasks"
        className={`${CONTROL} min-w-48 flex-1`}
      />

      <select
        aria-label="Filter by status"
        value={filters.status}
        onChange={(e) =>
          navigate({ status: e.target.value as IssueFilterState["status"] })
        }
        className={CONTROL}
      >
        <option value="">All statuses</option>
        {ISSUE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by priority"
        value={filters.priority}
        onChange={(e) =>
          navigate({ priority: e.target.value as IssueFilterState["priority"] })
        }
        className={CONTROL}
      >
        <option value="">All priorities</option>
        {ISSUE_PRIORITY_LIST.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by assignee"
        value={filters.assignee}
        onChange={(e) => navigate({ assignee: e.target.value })}
        className={CONTROL}
      >
        <option value="">Anyone</option>
        <option value="unassigned">Unassigned</option>
        {filters.assignee &&
          filters.assignee !== "unassigned" &&
          !assignees.some((user) => user.id === filters.assignee) && (
            <option value={filters.assignee}>Former member</option>
          )}
        {assignees.map((user) => (
          <option key={user.id} value={user.id}>
            {userLabel(user)}
          </option>
        ))}
      </select>

      {labels.length > 0 && (
        <select
          aria-label="Filter by label"
          value={filters.label}
          onChange={(e) => navigate({ label: e.target.value })}
          className={CONTROL}
        >
          <option value="">All labels</option>
          {filters.label && !labels.some((label) => label.id === filters.label) && (
            <option value={filters.label}>Deleted label</option>
          )}
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Sort tasks"
        value={filters.sort}
        onChange={(e) => navigate({ sort: e.target.value as IssueSort })}
        className={CONTROL}
      >
        {(Object.keys(SORT_LABELS) as IssueSort[]).map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </option>
        ))}
      </select>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setLastPushed("");
            router.push(`/${slug}/board`);
          }}
          className="text-sm text-zinc-500 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
