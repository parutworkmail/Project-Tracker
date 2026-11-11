import Link from "next/link";

import { LocalTime } from "@/components/local-time";

interface AssignmentRow {
  id: string;
  projectName: string;
  projectSlug: string;
  adminLabel: string;
  assignedBy: string | null;
  assignedAt: string;
}

export function AssignmentHistory({ rows }: { rows: AssignmentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No admin assignments yet. Assign an admin to a project above and it
        will show up here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-black/[.08] dark:border-white/[.145]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[.08] bg-black/[.03] text-left dark:border-white/[.145] dark:bg-white/[.06]">
            <th className="px-3 py-2 font-medium">Project</th>
            <th className="px-3 py-2 font-medium">Admin</th>
            <th className="px-3 py-2 font-medium">Assigned by</th>
            <th className="px-3 py-2 font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-black/[.08] last:border-b-0 dark:border-white/[.145]"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/${row.projectSlug}/board`}
                  className="hover:underline"
                >
                  {row.projectName}
                </Link>
              </td>
              <td className="px-3 py-2">{row.adminLabel}</td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                {row.assignedBy ?? "Deleted user"}
              </td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                <LocalTime iso={row.assignedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
