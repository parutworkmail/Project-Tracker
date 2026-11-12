import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject, getAssignableUsers } from "@/lib/permissions";
import { getIssue, listActivity, listComments } from "@/lib/projectSchema";
import { describeActivity, userLabel } from "@/lib/issueMeta";
import { IssueDetailForm } from "@/components/issue-detail-form";
import { IssueComments } from "@/components/issue-comments";
import { IssueActivity } from "@/components/issue-activity";
import { LocalTime } from "@/components/local-time";
import { ProjectNav } from "@/components/project-nav";

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

  const [comments, assignees, activity] = await Promise.all([
    listComments(project.schemaName, issueId),
    getAssignableUsers(project.id),
    listActivity(project.schemaName, issueId),
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
      <ProjectNav
        slug={project.slug}
        name={project.name}
        active="board"
        canManage={canManage}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Link
          href={`/${project.slug}/board`}
          className="mb-4 inline-block text-sm text-zinc-500 hover:underline"
        >
          ← Back to tasks
        </Link>

        <p className="mb-6 text-xs text-zinc-500">
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
          }}
          assignees={assignees}
          formerAssigneeLabel={
            issue.assignee_id ? (labels.get(issue.assignee_id) ?? null) : null
          }
          canManage={canManage}
        />

        <hr className="my-8 border-black/[.08] dark:border-white/[.145]" />

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

        <hr className="my-8 border-black/[.08] dark:border-white/[.145]" />

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
      </main>
    </div>
  );
}
