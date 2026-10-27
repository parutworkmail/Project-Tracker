import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/permissions";
import { JoinProjectButton } from "@/components/join-project-button";
import { ProjectManageControls } from "@/components/project-manage-controls";
import { BackLink } from "@/components/back-link";

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

  if (session.user.mustChangePassword) {
    redirect("/change-password");
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
        <BackLink href="/dashboard" label="Back to dashboard" />
        <h1 className="mb-6 text-2xl font-semibold">{project.name}</h1>
        <JoinProjectButton slug={project.slug} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <BackLink href="/dashboard" label="Back to dashboard" />
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
          <a
            href={`/projects/${project.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-black/[.06] px-1.5 py-0.5 hover:underline dark:bg-white/[.08]"
          >
            /projects/{project.slug}
          </a>
        </p>
      </main>
    </div>
  );
}
