import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ProjectListSection } from "@/components/project-list-section";
import { ProjectSearchInput } from "@/components/project-search-input";
import { ProjectListSkeleton } from "@/components/project-list-skeleton";

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

  const displayName = session.user.name || session.user.username || "there";
  const roleLabel =
    session.user.role === "SUPER_ADMIN"
      ? "Super admin"
      : session.user.role === "ADMIN"
        ? "Admin"
        : "Member";

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <section className="hero-gradient animate-fade-up relative mb-8 overflow-hidden rounded-3xl p-8 text-white shadow-xl shadow-slate-900/15 sm:p-10">
          <div
            aria-hidden="true"
            className="animate-float pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-yellow-300/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="animate-float-slow pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl"
          />

          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-300" />
                {roleLabel}
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Welcome back, {displayName}
              </h1>
              <p className="mt-2 max-w-xl text-white/75">
                Your projects
                <span className="text-white/50"> — </span>
                pick up where you left off, or start something new.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20"
                >
                  Admin console
                </Link>
              )}
              {isSuperAdmin && (
                <CreateProjectDialog availableUsers={availableUsers} />
              )}
            </div>
          </div>
        </section>

        <ProjectSearchInput initialQuery={query} />

        <Suspense
          key={`${query}:${page}`}
          fallback={<ProjectListSkeleton />}
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
