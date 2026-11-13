import { prisma } from "@/lib/prisma";

export interface DashboardSummary {
  projects: number;
  managed: number;
  collaborators: number;
}

// Totals for the whole account. They never depend on the search box or the page,
// so they stay the same while the project list below changes.
export async function getDashboardSummary(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<DashboardSummary> {
  if (isSuperAdmin) {
    const [projects, people] = await Promise.all([
      prisma.project.count(),
      prisma.$queryRaw<{ count: bigint | number }[]>`
        SELECT COUNT(DISTINCT "userId") AS count FROM "ProjectMember"
      `,
    ]);

    return {
      projects,
      managed: projects,
      collaborators: Number(people[0]?.count ?? 0),
    };
  }

  const [memberships, managed] = await Promise.all([
    prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
    role === "ADMIN"
      ? prisma.projectAdmin.findMany({ where: { userId }, select: { projectId: true } })
      : Promise.resolve([] as { projectId: string }[]),
  ]);

  const projectIds = new Set([...memberships, ...managed].map((row) => row.projectId));
  const managedIds = new Set(managed.map((row) => row.projectId));

  const people = projectIds.size
    ? await prisma.projectMember.findMany({
        where: { projectId: { in: [...projectIds] } },
        distinct: ["userId"],
        select: { userId: true },
      })
    : [];

  return {
    projects: projectIds.size,
    managed: managedIds.size,
    collaborators: people.length,
  };
}
