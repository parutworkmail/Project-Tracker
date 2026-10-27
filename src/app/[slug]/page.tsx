import { redirect, notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/permissions";
import { JoinProjectButton } from "@/components/join-project-button";
import { BackLink } from "@/components/back-link";

export const instant = false;

export default async function ProjectEntryPage({
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

  redirect(`/${project.slug}/board`);
}
