"use client";

import { useState } from "react";
import { useAppRouter } from "@/lib/useAppRouter";
import { DeleteProjectDialog } from "@/components/admin/delete-project-dialog";
import { useConfirm } from "@/components/confirm-provider";

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
  members: AdminUser[];
  admins: AdminUser[];
}

export function ProjectAdminManager({
  projects,
  availableAdmins,
  allUsers,
}: {
  projects: ProjectRow[];
  availableAdmins: AdminUser[];
  allUsers: AdminUser[];
}) {
  const router = useAppRouter();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [selectedMember, setSelectedMember] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  // The dialog stays mounted while it fades out, so the project is kept apart from
  // the open flag; the sequence number gives every opening an empty confirmation field.
  const [deleting, setDeleting] = useState<ProjectRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSeq, setDeleteSeq] = useState(0);

  function openDelete(project: ProjectRow) {
    setDeleting(project);
    setDeleteSeq((n) => n + 1);
    setDeleteOpen(true);
  }

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

  async function addMember(slug: string) {
    const userId = selectedMember[slug];
    const user = allUsers.find((u) => u.id === userId);
    if (!user) return;

    setPendingSlug(slug);
    setError(null);

    const res = await fetch(`/api/projects/${slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not add member.");
      setPendingSlug(null);
      return;
    }

    setSelectedMember((s) => ({ ...s, [slug]: "" }));
    setPendingSlug(null);
    router.refresh();
  }

  async function removeMember(slug: string, member: AdminUser, projectName: string) {
    const label = member.name ?? member.username;
    const ok = await confirm({
      title: "Remove member?",
      message: (
        <>
          Remove <strong>{label}</strong> from <strong>{projectName}</strong>? Their
          tasks in this project become unassigned.
        </>
      ),
      confirmLabel: "Remove member",
      tone: "danger",
    });

    if (!ok) return;

    setPendingSlug(slug);
    setError(null);

    const res = await fetch(`/api/projects/${slug}/members/${member.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not remove member.");
      setPendingSlug(null);
      return;
    }

    setPendingSlug(null);
    router.refresh();
  }

  async function unassign(slug: string, userId: string, adminLabel: string, projectName: string) {
    const ok = await confirm({
      title: "Remove project admin?",
      message: (
        <>
          Remove <strong>{adminLabel}</strong> as an admin of <strong>{projectName}</strong>?
          They keep their account and any membership, but lose the ability to manage the project.
        </>
      ),
      confirmLabel: "Remove admin",
      tone: "danger",
    });

    if (!ok) return;

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
          const addableMembers = allUsers.filter(
            (u) => !project.members.some((m) => m.id === u.id)
          );

          return (
            <div
              key={project.id}
              className="rounded border border-black/[.08] bg-surface p-4 dark:border-white/[.145]"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{project.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">
                    {project.members.length} member
                    {project.members.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => openDelete(project)}
                    aria-label={`Delete project ${project.name}`}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                  >
                    Delete project
                  </button>
                </div>
              </div>

              <p className="mb-1 text-xs font-medium text-zinc-500">Members</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {project.members.length === 0 ? (
                  <span className="text-xs text-zinc-500">No members.</span>
                ) : (
                  project.members.map((member) => (
                    <span
                      key={member.id}
                      className="flex items-center gap-1 rounded bg-black/[.06] px-2 py-1 text-xs dark:bg-white/[.08]"
                    >
                      {member.name ?? member.username}
                      <button
                        type="button"
                        disabled={pendingSlug === project.slug}
                        onClick={() => removeMember(project.slug, member, project.name)}
                        className="text-red-600 disabled:opacity-50"
                        aria-label={`Remove ${member.username} from ${project.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              {addableMembers.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <select
                    aria-label={`Add a member to ${project.name}`}
                    value={selectedMember[project.slug] ?? ""}
                    onChange={(e) =>
                      setSelectedMember((s) => ({ ...s, [project.slug]: e.target.value }))
                    }
                    className="rounded border border-black/[.08] bg-surface px-2 py-1 text-sm dark:border-white/[.145]"
                  >
                    <option value="">Select a person to add…</option>
                    {addableMembers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name ? `${user.name} (${user.username})` : user.username}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedMember[project.slug] || pendingSlug === project.slug}
                    onClick={() => addMember(project.slug)}
                    className="rounded bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50"
                  >
                    Add member
                  </button>
                </div>
              )}

              <p className="mb-1 text-xs font-medium text-zinc-500">Admins</p>
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
                        onClick={() =>
                          unassign(
                            project.slug,
                            admin.id,
                            admin.name ?? admin.username,
                            project.name
                          )
                        }
                        className="text-red-600 disabled:opacity-50"
                        aria-label={`Remove ${admin.username} as admin`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              {assignable.length > 0 ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selected[project.slug] ?? ""}
                    onChange={(e) =>
                      setSelected((s) => ({
                        ...s,
                        [project.slug]: e.target.value,
                      }))
                    }
                    className="rounded border border-black/[.08] bg-surface px-2 py-1 text-sm dark:border-white/[.145]"
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
              ) : (
                <p className="text-xs text-zinc-500">
                  No more ADMIN-role users available to assign. Create a new
                  user with the ADMIN role (or change an existing user&apos;s
                  role to ADMIN) above to add another admin to this project.
                </p>
              )}
            </div>
          );
        })
      )}

      {deleting && (
        <DeleteProjectDialog
          key={deleteSeq}
          open={deleteOpen}
          project={{ ...deleting, memberCount: deleting.members.length }}
          onClose={() => setDeleteOpen(false)}
          onExited={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
