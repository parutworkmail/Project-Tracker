import { getProjectStats } from "@/lib/projectSchema";
import { ProjectStatsStrip } from "@/components/project-stats-strip";

export async function ProjectStatsSection({ schemaName }: { schemaName: string }) {
  const stats = await getProjectStats(schemaName);

  return <ProjectStatsStrip stats={stats} />;
}

export function ProjectStatsSkeleton() {
  return (
    <div aria-hidden="true" className="mb-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-14" />
        ))}
      </div>
      <div className="skeleton mt-3 h-2" />
    </div>
  );
}
