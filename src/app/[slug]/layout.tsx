import { Suspense } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/permissions";
import { ProjectNav } from "@/components/project-nav";

// The project navbar lives here, not in each page, so it stays on screen while
// you move between a project's board, My tasks, Project Settings and task pages
// and only the content underneath changes. Leaving for the main site swaps it
// for that site's navbar, because that site has its own layout.
async function ProjectNavLoader({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id || session.user.mustChangePassword) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, members: { select: { userId: true } } },
  });

  if (!project) {
    return null;
  }

  const isMember = project.members.some((m) => m.userId === session.user.id);
  const canManage = await canManageProject(session.user.id, session.user.role, project.id);

  // People who are not in the project yet only see the Join page, without the menu.
  if (!isMember && !canManage) {
    return null;
  }

  return <ProjectNav slug={project.slug} name={project.name} canManage={canManage} />;
}

function ProjectNavSkeleton() {
  return <div aria-hidden="true" className="skeleton mb-6 h-[62px] w-full rounded-none" />;
}

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<ProjectNavSkeleton />}>
        <ProjectNavLoader params={params} />
      </Suspense>
      {children}
    </div>
  );
}
