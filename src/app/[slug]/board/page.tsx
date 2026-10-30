import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/permissions";
import { JoinProjectButton } from "@/components/join-project-button";
import { CreateIssueButton } from "@/components/create-issue-button";
import { IssueBoardSection } from "@/components/issue-board-section";
import { ProjectNav } from "@/components/project-nav";
import { BackLink } from "@/components/back-link";

export const instant = false;

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;

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
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-black">
        <BackLink href="/dashboard" label="Back to dashboard" />
        <h1 className="mb-6 text-2xl font-semibold">{project.name}</h1>
        <JoinProjectButton slug={project.slug} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <ProjectNav
        slug={project.slug}
        name={project.name}
        active="board"
        canManage={canManage}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">Tasks</h1>
          <CreateIssueButton slug={project.slug} />
        </div>

        <Suspense
          fallback={<p className="text-zinc-500">Loading tasks...</p>}
        >
          <IssueBoardSection
            slug={project.slug}
            schemaName={project.schemaName}
            canManage={canManage}
          />
        </Suspense>
      </main>
    </div>
  );
}
