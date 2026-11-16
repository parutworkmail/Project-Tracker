"use client";

import { useId, useState, type ReactNode } from "react";

type TabKey = "comments" | "activity";

// Both panels stay mounted (the inactive one is just hidden) so a half-written
// comment is not lost when switching to Activity and back.
export function IssueTabs({
  commentCount,
  activityCount,
  comments,
  activity,
}: {
  commentCount: number;
  activityCount: number;
  comments: ReactNode;
  activity: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("comments");
  const id = useId();

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "comments", label: "Comments", count: commentCount },
    { key: "activity", label: "Activity", count: activityCount },
  ];

  function select(next: TabKey, focus = false) {
    setTab(next);
    if (focus) document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Task discussion"
        className="mb-4 flex gap-1 border-b border-black/[.08] dark:border-white/[.145]"
      >
        {tabs.map((item) => {
          const selected = tab === item.key;

          return (
            <button
              key={item.key}
              id={`${id}-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel-${item.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  select(item.key === "comments" ? "activity" : "comments", true);
                }
              }}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                selected
                  ? "border-foreground text-foreground"
                  : "border-transparent text-zinc-500 hover:text-foreground"
              }`}
            >
              {item.label}{" "}
              <span className="font-normal text-zinc-500">({item.count})</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${id}-panel-comments`}
        aria-labelledby={`${id}-tab-comments`}
        hidden={tab !== "comments"}
      >
        {comments}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-activity`}
        aria-labelledby={`${id}-tab-activity`}
        hidden={tab !== "activity"}
      >
        {activity}
      </div>
    </div>
  );
}
