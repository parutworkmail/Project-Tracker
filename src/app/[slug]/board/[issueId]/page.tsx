import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject, getAssignableUsers } from "@/lib/permissions";
import { getIssue, listActivity, listComments, listLabels } from "@/lib/projectSchema";
import { describeActivity, userLabel } from "@/lib/issueMeta";
import { IssueDetailForm } from "@/components/issue-detail-form";
import { IssueComments } from "@/components/issue-comments";
import { IssueActivity } from "@/components/issue-activity";
import { IssueTabs } from "@/components/issue-tabs";
import { LocalTime } from "@/components/local-time";

export const instant = false;

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ slug: string; issueId: string }>;
}) {
  const session = await auth();
  const { slug, issueId } = await params;

  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/${slug}/board/${issueId}`)}`
    );
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
    redirect(`/${slug}`);
  }

  const issue = await getIssue(project.schemaName, issueId);

  if (!issue) {
    notFound();
  }

  const [comments, assignees, activity, projectLabels] = await Promise.all([
    listComments(project.schemaName, issueId),
    getAssignableUsers(project.id),
    listActivity(project.schemaName, issueId),
    listLabels(project.schemaName),
  ]);

  const userIds = [
    ...new Set(
      [
        issue.created_by,
        issue.assignee_id,
        ...comments.map((c) => c.author_id),
        ...activity.flatMap((a) => [
          a.actor_id,
          ...(a.field === "assignee_id" ? [a.old_value, a.new_value] : []),
        ]),
      ].filter((id): id is string => !!id)
    ),
  ];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, name: true },
  });
  const labels = new Map(users.map((u) => [u.id, userLabel(u)]));

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="sticky top-[3.75rem] z-30 -mx-6 mb-4 border-b border-black/[.06] bg-[var(--background)]/90 px-6 py-2 backdrop-blur dark:border-white/[.08]">
          <Link
            href={`/${project.slug}/board`}
            className="inline-block text-sm text-zinc-500 hover:underline"
          >
            ← Back to tasks
          </Link>
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          <span className="font-semibold text-foreground">#{issue.number}</span>
          {" · "}Created by {labels.get(issue.created_by) ?? "a former member"} on{" "}
          <LocalTime iso={new Date(issue.created_at).toISOString()} />
          {" · "}Updated <LocalTime iso={new Date(issue.updated_at).toISOString()} />
        </p>

        <IssueDetailForm
          slug={project.slug}
          issue={{
            id: issue.id,
            title: issue.title,
            description: issue.description,
            status: issue.status,
            priority: issue.priority,
            due_date: issue.due_date,
            assignee_id: issue.assignee_id,
            labelIds: issue.labels.map((label) => label.id),
          }}
          assignees={assignees}
          projectLabels={projectLabels}
          formerAssigneeLabel={
            issue.assignee_id ? (labels.get(issue.assignee_id) ?? null) : null
          }
          canManage={canManage}
        >
          <IssueTabs
            commentCount={comments.length}
            activityCount={activity.length}
            comments={
              <IssueComments
                slug={project.slug}
                issueId={issue.id}
                currentUserId={session.user.id}
                canManage={canManage}
                comments={comments.map((comment) => ({
                  id: comment.id,
                  authorId: comment.author_id,
                  authorLabel:
                    labels.get(comment.author_id) ?? "Former member",
                  body: comment.body,
                  createdAt: new Date(comment.created_at).toISOString(),
                }))}
              />
            }
            activity={
              <IssueActivity
                items={activity.map((entry) => ({
                  id: entry.id,
                  actorLabel: entry.actor_id
                    ? (labels.get(entry.actor_id) ?? "Former member")
                    : "Someone",
                  text: describeActivity(entry, (userId) =>
                    userId ? (labels.get(userId) ?? "a former member") : "nobody"
                  ),
                  createdAt: new Date(entry.created_at).toISOString(),
                }))}
              />
            }
          />
        </IssueDetailForm>
      </main>
    </div>
  );
}
