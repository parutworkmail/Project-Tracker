import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import {
  listOpenIssuesAssignedTo,
  MY_TASKS_PER_PROJECT,
  type AssignedIssue,
} from "@/lib/projectSchema";
import { listNotificationViews, listUserProjects } from "@/lib/notifications";
import { NotificationsSection } from "@/components/notifications-section";
import { PriorityBadge } from "@/components/issue-badges";
import { LabelChip } from "@/components/label-chip";
import { formatDueDate, STATUS_LABELS } from "@/lib/issueMeta";

export const instant = false;

interface ProjectGroup {
  slug: string;
  name: string;
  issues: AssignedIssue[];
}

export default async function MyTasksPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/my-tasks")}`);
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  const userId = session.user.id;

  const projects = await listUserProjects(userId);

  // One broken project must not hide the tasks from all the others.
  const [settled, notifications] = await Promise.all([
    Promise.allSettled(
      projects.map((project) =>
        listOpenIssuesAssignedTo(project.schemaName, userId)
      )
    ),
    listNotificationViews(projects, userId).catch(() => []),
  ]);

  const groups: ProjectGroup[] = [];
  let failed = 0;

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      failed += 1;
      return;
    }

    if (result.value.length > 0) {
      groups.push({
        slug: projects[index].slug,
        name: projects[index].name,
        issues: result.value,
      });
    }
  });

  // Today in the server's calendar; the board flags overdue in the browser's.
  const today = new Date().toISOString().slice(0, 10);
  const totalTasks = groups.reduce((sum, group) => sum + group.issues.length, 0);

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">My tasks</h1>
        <p className="mt-1 text-sm text-muted">
          Open tasks assigned to you across all your projects
          {totalTasks > 0 && ` (${totalTasks})`}.
        </p>

        <NotificationsSection items={notifications} showProject />

        <h2 className="mt-8 text-sm font-semibold">Tasks</h2>

        {failed > 0 && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {failed === 1
              ? "One project could not be loaded, so its tasks are missing."
              : `${failed} projects could not be loaded, so their tasks are missing.`}
          </p>
        )}

        {groups.length === 0 ? (
          <div className="surface mt-2 rounded-2xl p-8 text-center">
            <p className="font-medium">Nothing assigned to you right now.</p>
            <p className="mt-1 text-sm text-muted">
              Tasks assigned to you will show up here.
            </p>
            <Link
              href="/dashboard"
              className="btn-secondary mt-4 inline-flex rounded-xl px-4 py-2 text-sm"
            >
              Go to your projects
            </Link>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.slug} aria-label={group.name}>
                <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold">
                  <Link href={`/${group.slug}/board`} className="hover:underline">
                    {group.name}
                  </Link>
                  <span className="text-xs font-normal text-muted">
                    {group.issues.length}
                    {group.issues.length >= MY_TASKS_PER_PROJECT && "+"} open
                  </span>
                </h2>

                <ul className="surface divide-y divide-black/[.06] overflow-hidden rounded-2xl dark:divide-white/[.08]">
                  {group.issues.map((issue) => {
                    const overdue = !!issue.due_date && issue.due_date < today;

                    return (
                      <li
                        key={issue.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
                      >
                        <span className="w-10 text-xs text-zinc-500">
                          #{issue.number}
                        </span>
                        <Link
                          href={`/${group.slug}/board/${issue.id}`}
                          className="min-w-0 flex-1 truncate font-medium hover:underline"
                          title={issue.title}
                        >
                          {issue.title}
                        </Link>
                        {issue.labels.map((label) => (
                          <LabelChip key={label.id} label={label} />
                        ))}
                        <span className="text-xs text-muted">
                          {STATUS_LABELS[issue.status]}
                        </span>
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
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
