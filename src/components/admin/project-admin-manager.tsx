"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  admins: AdminUser[];
}

export function ProjectAdminManager({
  projects,
  availableAdmins,
}: {
  projects: ProjectRow[];
  availableAdmins: AdminUser[];
}) {
  const router = useRouter();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function assign(slug: string) {
    const userId = selected[slug];
    if (!userId) return;

    setPendingSlug(slug);
    setError(null);

    const res = await fetch(`/api/admin/projects/${slug}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "Assignment failed."
      );
      setPendingSlug(null);
      return;
    }

    setPendingSlug(null);
    router.refresh();
  }

  async function unassign(slug: string, userId: string) {
    setPendingSlug(slug);
    setError(null);

    const res = await fetch(`/api/admin/projects/${slug}/admins/${userId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        typeof body?.error === "string" ? body.error : "Removal failed."
      );
      setPendingSlug(null);
      return;
    }

    setPendingSlug(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500">No projects yet.</p>
      ) : (
        projects.map((project) => {
          const assignable = availableAdmins.filter(
            (a) => !project.admins.some((pa) => pa.id === a.id)
          );

          return (
            <div
              key={project.id}
              className="rounded border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-black"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{project.name}</span>
                <span className="text-xs text-zinc-500">
                  {project.memberCount} member
                  {project.memberCount !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {project.admins.length === 0 ? (
                  <span className="text-xs text-zinc-500">
                    No admins assigned.
                  </span>
                ) : (
                  project.admins.map((admin) => (
                    <span
                      key={admin.id}
                      className="flex items-center gap-1 rounded bg-black/[.06] px-2 py-1 text-xs dark:bg-white/[.08]"
                    >
                      {admin.name ?? admin.username}
                      <button
                        type="button"
                        disabled={pendingSlug === project.slug}
                        onClick={() => unassign(project.slug, admin.id)}
                        className="text-red-600 disabled:opacity-50"
                        aria-label={`Remove ${admin.username} as admin`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              {assignable.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selected[project.slug] ?? ""}
                    onChange={(e) =>
                      setSelected((s) => ({
                        ...s,
                        [project.slug]: e.target.value,
                      }))
                    }
                    className="rounded border border-black/[.08] bg-white px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black"
                  >
                    <option value="">Select an admin…</option>
                    {assignable.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name ?? admin.username}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={
                      !selected[project.slug] || pendingSlug === project.slug
                    }
                    onClick={() => assign(project.slug)}
                    className="rounded bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
