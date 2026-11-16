"use client";

import { useEffect, useState } from "react";

export const NOTIFICATIONS_CHANGED = "notifications:changed";

const POLL_MS = 60_000;

// Red count bubble for the "My tasks" menu item: 1-9, then "9+" (like Facebook).
// `initial` comes from the server render; the bubble then keeps itself fresh by
// asking again every minute, when the tab regains focus, and right after
// notifications are marked as read.
export function UnreadBadge({ slug, initial }: { slug?: string; initial?: number }) {
  const [live, setLive] = useState<{ from: number | undefined; value: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    const url = `/api/notifications/unread-count${
      slug ? `?slug=${encodeURIComponent(slug)}` : ""
    }`;

    async function refresh() {
      if (document.visibilityState === "hidden") return;

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as { count?: unknown };
        if (!cancelled && typeof data.count === "number") {
          setLive({ from: initial, value: data.count });
        }
      } catch {
        // Offline or database down: keep showing the last known number.
      }
    }

    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [slug, initial]);

  // A fresh server value (after a refresh or navigation) beats an older poll result.
  const count = live && live.from === initial ? live.value : (initial ?? live?.value ?? 0);

  if (count <= 0) return null;

  return (
    <span
      className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 align-middle text-[11px] font-bold leading-none text-white"
    >
      <span aria-hidden="true">{count > 9 ? "9+" : count}</span>
      <span className="sr-only">
        {count} unread {count === 1 ? "notification" : "notifications"}
      </span>
    </span>
  );
}
