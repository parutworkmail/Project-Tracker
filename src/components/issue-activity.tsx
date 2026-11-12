import { LocalTime } from "@/components/local-time";

export interface ActivityView {
  id: string;
  actorLabel: string;
  text: string;
  createdAt: string;
}

export function IssueActivity({ items }: { items: ActivityView[] }) {
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="mb-3 text-lg font-semibold">
        Activity
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity recorded yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l border-black/[.1] pl-4 dark:border-white/[.12]">
          {items.map((item) => (
            <li key={item.id} className="relative text-sm">
              <span
                aria-hidden="true"
                className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-[var(--background)]"
              />
              <span className="font-medium">{item.actorLabel}</span>{" "}
              <span className="text-muted">{item.text}</span>
              <span className="block text-xs text-zinc-500">
                <LocalTime iso={item.createdAt} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
