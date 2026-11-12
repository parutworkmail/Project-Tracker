import type { ProjectStats } from "@/lib/projectSchema";

export function completionPercent(stats: ProjectStats): number {
  if (stats.total === 0) return 0;
  return Math.round((stats.done / stats.total) * 100);
}

export function ProjectStatsStrip({ stats }: { stats: ProjectStats }) {
  const percent = completionPercent(stats);

  const tiles: { label: string; value: number; tone?: string }[] = [
    { label: "Total", value: stats.total },
    { label: "To do", value: stats.todo },
    { label: "In progress", value: stats.inProgress },
    { label: "Done", value: stats.done },
    {
      label: "Overdue",
      value: stats.overdue,
      tone: stats.overdue > 0 ? "text-red-600" : undefined,
    },
    { label: "Unassigned", value: stats.unassigned },
  ];

  return (
    <section aria-label="Project summary" className="mb-5">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <li key={tile.label} className="surface rounded-xl px-3 py-2">
            <p className="text-xs text-muted">{tile.label}</p>
            <p className={`text-xl font-semibold ${tile.tone ?? ""}`}>
              {tile.value}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 flex-1 overflow-hidden rounded-full bg-black/[.08] dark:bg-white/[.12]"
        >
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="w-24 text-right text-xs text-muted">
          {percent}% complete
        </span>
      </div>
    </section>
  );
}
