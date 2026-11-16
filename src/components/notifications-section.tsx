import Link from "next/link";

import { Collapsible } from "@/components/collapsible";
import { LocalTime } from "@/components/local-time";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import type { NotificationView } from "@/lib/notifications";

const VISIBLE = 5;

function NotificationRow({
  item,
  showProject,
}: {
  item: NotificationView;
  showProject: boolean;
}) {
  return (
    <li>
      <Link
        href={`/${item.projectSlug}/board/${item.issueId}`}
        className={`flex items-start gap-3 px-4 py-3 text-sm hover:bg-accent/[.08] ${
          item.read ? "text-muted" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            item.read ? "bg-transparent" : "bg-red-600"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className={item.read ? "" : "font-medium"}>
            <strong className="font-semibold">{item.actorLabel}</strong>{" "}
            {item.kind === "mention" ? "tagged you in a comment on" : "assigned you to"}{" "}
            <span className="font-semibold">#{item.issueNumber}</span> {item.issueTitle}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {showProject && <>{item.projectName} · </>}
            <LocalTime iso={item.createdAt} />
            {!item.read && <span className="sr-only"> (unread)</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

const LIST =
  "surface divide-y divide-black/[.06] overflow-hidden rounded-2xl dark:divide-white/[.08]";

// Shown above the task list on both My tasks pages, so only the newest few are
// open; older ones fold away and the tasks stay close. `slug` limits "Mark all
// as read" to one project; leave it out on the all-projects page.
export function NotificationsSection({
  items,
  slug,
  showProject = false,
}: {
  items: NotificationView[];
  slug?: string;
  showProject?: boolean;
}) {
  const unread = items.filter((item) => !item.read).length;
  const recent = items.slice(0, VISIBLE);
  const older = items.slice(VISIBLE);

  return (
    <section aria-labelledby="notifications-heading" className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="notifications-heading" className="flex items-center text-sm font-semibold">
          Notifications
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold leading-none text-white">
              {unread > 9 ? "9+" : unread} new
            </span>
          )}
        </h2>
        {unread > 0 && <MarkAllReadButton slug={slug} />}
      </div>

      {items.length === 0 ? (
        <p className="surface rounded-2xl px-4 py-5 text-center text-sm text-muted">
          No notifications yet. You will see it here when someone tags you in a
          comment or assigns a task to you.
        </p>
      ) : (
        <>
          <ul className={LIST}>
            {recent.map((item) => (
              <NotificationRow key={item.id} item={item} showProject={showProject} />
            ))}
          </ul>

          {older.length > 0 && (
            <Collapsible
              variant="plain"
              summary={`Show ${older.length} older`}
              className="mt-2"
            >
              <ul className={LIST}>
                {older.map((item) => (
                  <NotificationRow key={item.id} item={item} showProject={showProject} />
                ))}
              </ul>
            </Collapsible>
          )}
        </>
      )}
    </section>
  );
}
