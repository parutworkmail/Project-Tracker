import Link from "next/link";

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
}

export function ProjectList({
  projects,
  isSuperAdmin,
  query,
  page,
  totalCount,
  pageSize,
}: {
  projects: ProjectRow[];
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
      <p className="text-zinc-500">
        {query ? (
          <>No projects match &ldquo;{query}&rdquo;.</>
        ) : (
          <>
            No projects yet.{" "}
            {isSuperAdmin
              ? "Create one above to get started."
              : "Ask a super admin to create one, or join via a shared link."}
          </>
        )}
      </p>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/${project.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded border border-black/[.08] bg-white px-4 py-3 hover:bg-black/[.02] dark:border-white/[.145] dark:bg-black dark:hover:bg-white/[.04]"
            >
              <span className="font-medium">{project.name}</span>
            </Link>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <Link
            href={`/dashboard?page=${page - 1}${qParam}`}
            aria-disabled={page <= 1}
            className={
              page <= 1
                ? "pointer-events-none opacity-40"
                : "hover:underline"
            }
          >
            ← Previous
          </Link>
          <span>
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/dashboard?page=${page + 1}${qParam}`}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:underline"
            }
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
