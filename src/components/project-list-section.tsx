import { prisma } from "@/lib/prisma";
import { ProjectList } from "@/components/project-list";
import type { ProjectCardData } from "@/components/project-list";

const PAGE_SIZE = 20;

export async function ProjectListSection({
  isSuperAdmin,
  userId,
  role,
  query,
  page,
}: {
  isSuperAdmin: boolean;
  userId: string;
  role: string;
  query: string;
  page: number;
}) {
  const { projects, totalCount } = isSuperAdmin
    ? await getSuperAdminProjectsPage(query, page)
    : await getMemberAndManagedProjectsPage(userId, role, query, page);

  return (
    <ProjectList
      projects={projects}
      isSuperAdmin={isSuperAdmin}
      query={query}
      page={page}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}

const withMemberCount = { _count: { select: { members: true } } } as const;

function toCard(
  project: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    _count: { members: number };
  },
  isManager: boolean
): ProjectCardData {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    memberCount: project._count.members,
    isManager,
    createdAt: project.createdAt.toISOString().slice(0, 10),
  };
}

// SUPER_ADMIN can see every project system-wide — this is the genuinely
// unbounded case, so search/pagination happen at the SQL level: only the
// one page of matching rows is ever fetched, never the whole table.
async function getSuperAdminProjectsPage(query: string, page: number) {
  const where = query
    ? { name: { contains: query, mode: "insensitive" as const } }
    : {};

  const [projects, totalCount] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: withMemberCount,
    }),
    prisma.project.count({ where }),
  ]);

  return { projects: projects.map((p) => toCard(p, true)), totalCount };
}

// A single user's own membership/managed-project count is bounded by how
// many projects they've personally joined or been assigned to admin —
// not the system-wide total — so fetching that candidate set in full and
// filtering/paginating it in memory is a deliberate, scoped choice, not
// the same unbounded risk as the SUPER_ADMIN path above.
async function getMemberAndManagedProjectsPage(
  userId: string,
  role: string,
  query: string,
  page: number
) {
  const [memberships, managed] = await Promise.all([
    prisma.projectMember.findMany({
      where: { userId },
      include: { project: { include: withMemberCount } },
      orderBy: { createdAt: "desc" },
    }),
    role === "ADMIN"
      ? prisma.project.findMany({
          where: { admins: { some: { userId } } },
          orderBy: { createdAt: "desc" },
          include: withMemberCount,
        })
      : Promise.resolve([]),
  ]);

  const managedIds = new Set(managed.map((p) => p.id));
  const memberProjects = memberships.map((m) => m.project);
  const seen = new Set(memberProjects.map((p) => p.id));
  const extra = managed.filter((p) => !seen.has(p.id));
  const all = [...memberProjects, ...extra];

  const filtered = query
    ? all.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : all;

  const totalCount = filtered.length;
  const start = (page - 1) * PAGE_SIZE;
  const projects = filtered
    .slice(start, start + PAGE_SIZE)
    .map((p) => toCard(p, managedIds.has(p.id)));

  return { projects, totalCount };
}
