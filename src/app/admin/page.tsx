import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRoleManager } from "@/components/admin/user-role-manager";
import { ProjectAdminManager } from "@/components/admin/project-admin-manager";

export const instant = false;

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const [users, projects] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, username: true, name: true, email: true, role: true },
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        admins: {
          include: {
            user: { select: { id: true, username: true, name: true, email: true } },
          },
        },
        _count: { select: { members: true } },
      },
    }),
  ]);

  const admins = users.filter((u) => u.role === "ADMIN");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="mb-8 text-2xl font-semibold">Admin console</h1>

        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Users</h2>
            <Link
              href="/admin/users/new"
              className="rounded bg-foreground px-3 py-1 text-xs text-background"
            >
              Create user
            </Link>
          </div>
          <UserRoleManager
            users={users}
            currentUserId={session.user.id}
          />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium">Projects</h2>
          <ProjectAdminManager
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              memberCount: p._count.members,
              admins: p.admins.map((a) => ({
                id: a.user.id,
                username: a.user.username,
                name: a.user.name,
                email: a.user.email,
              })),
            }))}
            availableAdmins={admins}
          />
        </section>
      </main>
    </div>
  );
}
