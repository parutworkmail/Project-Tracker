import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { searchIssues } from "@/lib/projectSchema";
import { IssueTable } from "@/components/issue-table";
import { userLabel } from "@/lib/issueMeta";
import {
  buildBoardQuery,
  hasActiveFilters,
  type IssueFilterState,
} from "@/lib/issueFilters";

export async function IssueBoardSection({
  slug,
  schemaName,
  canManage,
  filters,
}: {
  slug: string;
  schemaName: string;
  canManage: boolean;
  filters: IssueFilterState;
}) {
  const { issues, total, page, pageSize } = await searchIssues(schemaName, {
    q: filters.q || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    assignee: filters.assignee || undefined,
    label: filters.label || undefined,
    sort: filters.sort,
    page: filters.page,
  });

  if (issues.length === 0 && total > 0 && page > 1) {
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    redirect(`/${slug}/board${buildBoardQuery(filters, { page: lastPage })}`);
  }

  const assigneeIds = [
    ...new Set(
      issues.map((issue) => issue.assignee_id).filter((id): id is string => !!id)
    ),
  ];

  const users = assigneeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, username: true, name: true },
      })
    : [];

  const assigneeNames = Object.fromEntries(
    users.map((user) => [user.id, userLabel(user)])
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <IssueTable
        slug={slug}
        issues={issues}
        assigneeNames={assigneeNames}
        canManage={canManage}
        filtered={hasActiveFilters(filters)}
      />

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            {total} {total === 1 ? "task" : "tasks"}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-4">
              {page <= 1 ? (
                <span aria-disabled="true" className="opacity-40">
                  ← Previous
                </span>
              ) : (
                <Link
                  href={`/${slug}/board${buildBoardQuery(filters, { page: page - 1 })}`}
                  className="hover:underline"
                >
                  ← Previous
                </Link>
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page >= totalPages ? (
                <span aria-disabled="true" className="opacity-40">
                  Next →
                </span>
              ) : (
                <Link
                  href={`/${slug}/board${buildBoardQuery(filters, { page: page + 1 })}`}
                  className="hover:underline"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
