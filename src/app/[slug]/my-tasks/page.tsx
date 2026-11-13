import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/permissions";
import { listOpenIssuesAssignedTo, MY_TASKS_PER_PROJECT } from "@/lib/projectSchema";
import { formatDueDate, STATUS_LABELS } from "@/lib/issueMeta";
import { PriorityBadge } from "@/components/issue-badges";
import { LabelChip } from "@/components/label-chip";

export const instant = false;

export default async function ProjectMyTasksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/${slug}/my-tasks`)}`);
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!project) {
    notFound();
  }

  const isMember = project.members.some((m) => m.userId === session.user.id);
  const canManage = await canManageProject(
    session.user.id,
    session.user.role,
    project.id
  );

  if (!isMember && !canManage) {
    redirect(`/${slug}/board`);
  }

  const issues = await listOpenIssuesAssignedTo(project.schemaName, session.user.id);

  // Today in the server's calendar; the board flags overdue in the browser's.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">My tasks</h1>
        <p className="mt-1 text-sm text-muted">
          Open tasks assigned to you in {project.name}
          {issues.length > 0 && ` (${issues.length}${issues.length >= MY_TASKS_PER_PROJECT ? "+" : ""})`}.
        </p>

        {issues.length === 0 ? (
          <div className="surface mt-8 rounded-2xl p-8 text-center">
            <p className="font-medium">Nothing assigned to you in this project.</p>
            <p className="mt-1 text-sm text-muted">
              Tasks assigned to you will show up here.
            </p>
            <Link
              href={`/${project.slug}/board`}
              className="btn-secondary mt-4 inline-flex rounded-xl px-4 py-2 text-sm"
            >
              Go to the task board
            </Link>
          </div>
        ) : (
          <ul className="surface mt-6 divide-y divide-black/[.06] overflow-hidden rounded-2xl dark:divide-white/[.08]">
            {issues.map((issue) => {
              const overdue = !!issue.due_date && issue.due_date < today;

              return (
                <li
                  key={issue.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
                >
                  <span className="w-10 text-xs text-zinc-500">#{issue.number}</span>
                  <Link
                    href={`/${project.slug}/board/${issue.id}`}
                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                    title={issue.title}
                  >
                    {issue.title}
                  </Link>
                  {issue.labels.map((label) => (
                    <LabelChip key={label.id} label={label} />
                  ))}
                  <span className="text-xs text-muted">{STATUS_LABELS[issue.status]}</span>
                  <PriorityBadge priority={issue.priority} />
                  <span
                    className={`w-28 text-right text-xs ${
                      overdue ? "font-medium text-red-600" : "text-muted"
                    }`}
                  >
                    {issue.due_date ? formatDueDate(issue.due_date) : "No due date"}
                    {overdue && " · overdue"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
