import { getDashboardSummary } from "@/lib/dashboardSummary";

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
      className="animate-fade-up rounded-2xl bg-black/[.028] px-5 py-3 dark:bg-white/[.04]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted/80">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-semibold text-foreground/65">{value}</p>
      <p className="mt-0.5 text-xs text-muted/80">{hint}</p>
    </div>
  );
}

export async function DashboardSummarySection({
  userId,
  role,
  isSuperAdmin,
}: {
  userId: string;
  role: string;
  isSuperAdmin: boolean;
}) {
  const summary = await getDashboardSummary(userId, role, isSuperAdmin);

  return (
    <section aria-label="Your account at a glance" className="mb-10 grid gap-3 sm:grid-cols-3">
      <StatTile
        label="Projects"
        value={summary.projects}
        hint={summary.projects === 1 ? "space you can open" : "spaces you can open"}
        delay={0}
      />
      <StatTile
        label="You manage"
        value={summary.managed}
        hint="with full control"
        delay={70}
      />
      <StatTile
        label="Collaborators"
        value={summary.collaborators}
        hint="people across your projects"
        delay={140}
      />
    </section>
  );
}

export function DashboardSummarySkeleton() {
  return (
    <div aria-hidden="true" className="mb-10 grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="skeleton h-[84px] rounded-2xl" />
      ))}
    </div>
  );
}
