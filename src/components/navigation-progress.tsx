"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useNavigationBusy } from "@/lib/useAppRouter";

const GIVE_UP_MS = 15_000;

// One progress bar for the whole app. It runs while a <Link> click is loading
// the next page, and while any useAppRouter navigation/refresh is pending.
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const routerBusy = useNavigationBusy();
  const [linkPending, setLinkPending] = useState(false);

  const locationKey = `${pathname}?${search}`;
  const [lastKey, setLastKey] = useState(locationKey);

  if (lastKey !== locationKey) {
    setLastKey(locationKey);
    setLinkPending(false);
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Next's <Link> calls preventDefault when it takes over a click, which
      // also filters out new-tab, modified and download clicks.
      if (!event.defaultPrevented || !(event.target instanceof Element)) return;

      const anchor = event.target.closest("a");
      if (!anchor?.href) return;

      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      ) {
        return;
      }

      setLinkPending(true);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!linkPending) return;

    const timer = setTimeout(() => setLinkPending(false), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [linkPending]);

  return (
    <div
      aria-hidden="true"
      className="nav-progress"
      data-active={linkPending || routerBusy ? "true" : "false"}
    />
  );
}
