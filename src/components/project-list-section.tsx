import { prisma } from "@/lib/prisma";
import { ProjectList } from "@/components/project-list";

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
    }),
    prisma.project.count({ where }),
  ]);

  return { projects, totalCount };
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
      include: { project: true },
      orderBy: { createdAt: "desc" },
    }),
    role === "ADMIN"
      ? prisma.project.findMany({
          where: { admins: { some: { userId } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const memberProjects = memberships.map((m) => m.project);
  const seen = new Set(memberProjects.map((p) => p.id));
  const extra = managed.filter((p) => !seen.has(p.id));
  const all = [...memberProjects, ...extra];

  const filtered = query
    ? all.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : all;

  const totalCount = filtered.length;
  const start = (page - 1) * PAGE_SIZE;
  const projects = filtered.slice(start, start + PAGE_SIZE);

  return { projects, totalCount };
}
