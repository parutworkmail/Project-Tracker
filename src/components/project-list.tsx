import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { formatDueDate } from "@/lib/issueMeta";

export interface ProjectCardData {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  isManager: boolean;
  createdAt: string;
}

function StatTile({
  label,
  value,
  hint,
  delay,
}: {
  label: string;
  value: string | number;
  hint: string;
  delay: number;
}) {
  return (
    <div
      className="surface animate-fade-up rounded-2xl px-5 py-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="gradient-text mt-1 text-3xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

export function ProjectList({
  projects,
  isSuperAdmin,
  query,
  page,
  totalCount,
  pageSize,
}: {
  projects: ProjectCardData[];
  isSuperAdmin: boolean;
  query: string;
  page: number;
  totalCount: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const qParam = query ? `&q=${encodeURIComponent(query)}` : "";

  if (totalCount === 0) {
    return (
      <div className="surface animate-fade-up flex flex-col items-center rounded-3xl border-dashed px-6 py-16 text-center">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-yellow-200 to-yellow-400 text-on-accent shadow-lg shadow-yellow-500/25">
          <svg
            viewBox="0 0 24 24"
            width="36"
            height="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-yellow-300/70" />
        </div>
        <h2 className="text-lg font-semibold">
          {query ? "No matching projects" : "No projects yet"}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          {query ? (
            <>No projects match &ldquo;{query}&rdquo;. Try a different name.</>
          ) : isSuperAdmin ? (
            "Create one above to get started."
          ) : (
            "Ask a super admin to create one, or join via a shared link."
          )}
        </p>
      </div>
    );
  }

  const managedCount = projects.filter((p) => p.isManager).length;
  const peopleCount = projects.reduce((sum, p) => sum + p.memberCount, 0);
  const showStats = !query && page === 1;

  return (
    <div>
      {showStats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Projects"
            value={totalCount}
            hint={totalCount === 1 ? "space you can open" : "spaces you can open"}
            delay={0}
          />
          <StatTile
            label="You manage"
            value={managedCount}
            hint="with full control"
            delay={70}
          />
          <StatTile
            label="Collaborators"
            value={peopleCount}
            hint="across this page"
            delay={140}
          />
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, index) => (
          <li
            key={project.id}
            className="animate-fade-up"
            style={{ animationDelay: `${Math.min(index, 12) * 55 + 120}ms` }}
          >
            <Link
              href={`/${project.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="surface card-lift group block rounded-2xl p-5"
            >
              <div className="flex items-start gap-4">
                <Avatar name={project.name} seed={project.slug} size={46} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{project.name}</h3>
                  <p className="truncate text-xs text-muted">/{project.slug}</p>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="mt-1 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground dark:group-hover:text-accent-text group-hover:opacity-100"
                >
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </div>

              <div className="mt-5 flex items-center justify-between text-xs">
                <span
                  className={
                    project.isManager
                      ? "rounded-full bg-yellow-200/80 px-2.5 py-1 font-medium text-slate-800 dark:bg-yellow-300/15 dark:text-yellow-200"
                      : "rounded-full bg-teal-100 px-2.5 py-1 font-medium text-teal-800 dark:bg-teal-400/15 dark:text-teal-300"
                  }
                >
                  {project.isManager ? "Manager" : "Member"}
                </span>
                <span className="text-muted">
                  {project.memberCount}{" "}
                  {project.memberCount === 1 ? "member" : "members"}
                  {" · "}
                  {formatDueDate(project.createdAt)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav
          aria-label="Project pages"
          className="mt-8 flex items-center justify-between text-sm"
        >
          {page <= 1 ? (
            <span
              aria-disabled="true"
              className="surface rounded-xl px-4 py-2 opacity-40"
            >
              ← Previous
            </span>
          ) : (
            <Link
              href={`/dashboard?page=${page - 1}${qParam}`}
              className="surface rounded-xl px-4 py-2 hover:border-accent/60"
            >
              ← Previous
            </Link>
          )}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page >= totalPages ? (
            <span
              aria-disabled="true"
              className="surface rounded-xl px-4 py-2 opacity-40"
            >
              Next →
            </span>
          ) : (
            <Link
              href={`/dashboard?page=${page + 1}${qParam}`}
              className="surface rounded-xl px-4 py-2 hover:border-accent/60"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
