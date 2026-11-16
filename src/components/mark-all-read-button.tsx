"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { NOTIFICATIONS_CHANGED } from "@/components/unread-badge";

// Clears every unread notification in one project (pass its slug) or, without a
// slug, in all of the person's projects.
export function MarkAllReadButton({ slug }: { slug?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markAll() {
    setBusy(true);

    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slug ? { slug } : {}),
      });

      if (res.ok) {
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={markAll}
      disabled={busy}
      className="text-xs text-muted hover:text-foreground hover:underline disabled:opacity-50"
    >
      {busy ? "Marking…" : "Mark all as read"}
    </button>
  );
}
