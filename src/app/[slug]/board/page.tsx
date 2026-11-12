import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject, getAssignableUsers } from "@/lib/permissions";
import { buildBoardQuery, parseIssueFilters } from "@/lib/issueFilters";
import { IssueFilters } from "@/components/issue-filters";
import { LeaveProjectButton } from "@/components/leave-project-button";
import { JoinProjectButton } from "@/components/join-project-button";
import { CreateIssueButton } from "@/components/create-issue-button";
import { IssueBoardSection } from "@/components/issue-board-section";
import { listLabels } from "@/lib/projectSchema";
import { ProjectNav } from "@/components/project-nav";
import { BackLink } from "@/components/back-link";

export const instant = false;

export default async function ProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const { slug } = await params;
  const filters = parseIssueFilters(await searchParams);

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/${slug}/board`)}`);
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

  const membership = project.members.find(
    (m) => m.userId === session.user.id
  );

  const canManage = await canManageProject(
    session.user.id,
    session.user.role,
    project.id
  );

  if (!membership && !canManage) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <BackLink href="/dashboard" label="Back to dashboard" />
        <h1 className="mb-6 text-2xl font-semibold">{project.name}</h1>
        <JoinProjectButton slug={project.slug} />
      </div>
    );
  }

  const [assignees, labels] = await Promise.all([
    getAssignableUsers(project.id),
    listLabels(project.schemaName),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <ProjectNav
        slug={project.slug}
        name={project.name}
        active="board"
        canManage={canManage}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">Tasks</h1>
          <div className="flex items-start gap-2">
            {membership && (
              <LeaveProjectButton
                slug={project.slug}
                projectName={project.name}
                userId={session.user.id}
              />
            )}
            <a
              href={`/api/projects/${project.slug}/issues/export${buildBoardQuery(filters, { page: 1, view: "list" })}`}
              download
              className="btn-secondary rounded-xl px-3 py-1.5 text-sm"
            >
              Export CSV
            </a>
            <CreateIssueButton slug={project.slug} assignees={assignees} />
          </div>
        </div>

        <IssueFilters
          slug={project.slug}
          filters={filters}
          assignees={assignees}
          labels={labels}
        />

        <Suspense
          key={buildBoardQuery(filters)}
          fallback={<p className="text-zinc-500">Loading tasks…</p>}
        >
          <IssueBoardSection
            slug={project.slug}
            schemaName={project.schemaName}
            canManage={canManage}
            filters={filters}
          />
        </Suspense>
      </main>
    </div>
  );
}
