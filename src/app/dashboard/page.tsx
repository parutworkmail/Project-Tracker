import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateProjectForm } from "@/components/create-project-form";

export const instant = false;

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your projects</h1>
          {isSuperAdmin && (
            <Link
              href="/admin"
              className="rounded border border-black/[.08] px-3 py-1 text-sm dark:border-white/[.145]"
            >
              Admin console
            </Link>
          )}
        </div>

        {isSuperAdmin && (
          <div className="mb-8">
            <CreateProjectForm />
          </div>
        )}

        {memberships.length === 0 ? (
          <p className="text-zinc-500">
            No projects yet.{" "}
            {isSuperAdmin
              ? "Create one above to get started."
              : "Ask a super admin to create one, or join via a shared link."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {memberships.map(({ project }) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.slug}`}
                  className="flex items-center justify-between rounded border border-black/[.08] bg-white px-4 py-3 hover:bg-black/[.02] dark:border-white/[.145] dark:bg-black dark:hover:bg-white/[.04]"
                >
                  <span className="font-medium">{project.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
