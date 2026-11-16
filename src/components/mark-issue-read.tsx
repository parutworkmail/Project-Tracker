"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { NOTIFICATIONS_CHANGED } from "@/components/unread-badge";

// Opening a task counts as reading what was said about it: clears this task's
// notifications, then refreshes the menu bubble.
export function MarkIssueRead({ slug, issueId }: { slug: string; issueId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, issueId }),
    })
      .then((res) => {
        if (cancelled || !res.ok) return;
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
        router.refresh();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slug, issueId, router]);

  return null;
}
