import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listIssues } from "@/lib/projectSchema";
import { canManageProject } from "@/lib/permissions";
import { JoinProjectButton } from "@/components/join-project-button";
import { CreateIssueForm } from "@/components/create-issue-form";
import { IssueCard } from "@/components/issue-card";
import { ProjectManageControls } from "@/components/project-manage-controls";

export const instant = false;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { slug } = await params;

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
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-black">
        <h1 className="mb-6 text-2xl font-semibold">{project.name}</h1>
        <JoinProjectButton slug={project.slug} />
      </div>
    );
  }

  const issues = await listIssues(project.schemaName);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <span className="text-xs text-zinc-500">
            {project.members.length} member
            {project.members.length !== 1 ? "s" : ""}
          </span>
        </div>

        {canManage && (
          <div className="mb-4">
            <ProjectManageControls slug={project.slug} name={project.name} />
          </div>
        )}

        <p className="mb-8 text-sm text-zinc-500">
          Shareable link:{" "}
          <code className="rounded bg-black/[.06] px-1.5 py-0.5 dark:bg-white/[.08]">
            /projects/{project.slug}
          </code>
        </p>

        <div className="mb-8">
          <CreateIssueForm slug={project.slug} />
        </div>

        {issues.length === 0 ? (
          <p className="text-zinc-500">No issues yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {issues.map((issue) => (
              <IssueCard key={issue.id} slug={project.slug} issue={issue} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
