import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ProjectListSection } from "@/components/project-list-section";
import { ProjectSearchInput } from "@/components/project-search-input";

export const instant = false;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  const { q, page: pageParam } = await searchParams;
  const query = (q ?? "").trim();
  const page = Math.max(1, Number(pageParam) || 1);

  const availableUsers = isSuperAdmin
    ? await prisma.user.findMany({
        where: { id: { not: session.user.id } },
        orderBy: { username: "asc" },
        select: { id: true, username: true, name: true },
      })
    : [];

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
            <CreateProjectDialog availableUsers={availableUsers} />
          </div>
        )}

        <ProjectSearchInput initialQuery={query} />

        <Suspense
          key={`${query}:${page}`}
          fallback={<p className="text-zinc-500">Searching…</p>}
        >
          <ProjectListSection
            isSuperAdmin={isSuperAdmin}
            userId={session.user.id}
            role={session.user.role}
            query={query}
            page={page}
          />
        </Suspense>
      </main>
    </div>
  );
}
