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

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Your projects</h2>
        <p className="text-xs text-muted">Click a project to open it in a new tab</p>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
              aria-label={`Open project ${project.name}`}
              className="project-card surface card-lift group relative block cursor-pointer rounded-2xl p-5"
            >
              <div className="flex items-start gap-4">
                <Avatar name={project.name} seed={project.slug} size={46} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{project.name}</h3>
                  <p className="truncate text-xs text-muted">/{project.slug}</p>
                </div>
                <span
                  aria-hidden="true"
                  className="project-card-open flex h-9 w-9 flex-none items-center justify-center rounded-full border border-black/[.12] text-foreground dark:border-white/[.2]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </span>
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
