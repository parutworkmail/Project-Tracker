import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/permissions";
import { ProjectManageControls } from "@/components/project-manage-controls";
import { ProjectMemberManager } from "@/components/project-member-manager";
import { ProjectNav } from "@/components/project-nav";

export const instant = false;

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/${slug}/settings`)}`);
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: { select: { id: true, username: true, name: true, email: true } },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const canManage = await canManageProject(
    session.user.id,
    session.user.role,
    project.id
  );

  if (!canManage) {
    redirect(`/${project.slug}/board`);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <ProjectNav
        slug={project.slug}
        name={project.name}
        active="settings"
        canManage={canManage}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-500">
            Name &amp; shareable link
          </h2>
          <ProjectManageControls slug={project.slug} name={project.name} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-500">Members</h2>
          <ProjectMemberManager
            slug={project.slug}
            members={project.members.map((m) => ({
              id: m.user.id,
              username: m.user.username,
              name: m.user.name,
              email: m.user.email,
            }))}
          />
        </section>
      </main>
    </div>
  );
}
