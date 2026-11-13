"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { navigationBusy } from "@/lib/navigationBusy";

type NavigateOptions = Parameters<ReturnType<typeof useRouter>["push"]>[1];

const GIVE_UP_MS = 15_000;

// Drop-in replacement for next/navigation's useRouter(). push / replace /
// refresh run inside a transition and mark the app as "navigating" from the
// moment they are called until the new page is on screen, which drives the
// global progress bar and lets buttons stay busy instead of flashing idle.
// The returned object is stable, so it is safe in effect dependencies.
export function useAppRouter() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const armed = useRef(0);
  const giveUp = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const release = useCallback(() => {
    clearTimeout(giveUp.current);

    while (armed.current > 0) {
      armed.current -= 1;
      navigationBusy.end();
    }
  }, []);

  // The transition finished (or this component left the screen with the page).
  useEffect(() => {
    if (!isPending) release();
  }, [isPending, release]);

  useEffect(() => release, [release]);

  const run = useCallback(
    (navigate: () => void) => {
      armed.current += 1;
      navigationBusy.begin();
      clearTimeout(giveUp.current);
      giveUp.current = setTimeout(release, GIVE_UP_MS);
      startTransition(navigate);
    },
    [release, startTransition]
  );

  return useMemo(
    () => ({
      push: (href: string, options?: NavigateOptions) =>
        run(() => router.push(href, options)),
      replace: (href: string, options?: NavigateOptions) =>
        run(() => router.replace(href, options)),
      refresh: () => run(() => router.refresh()),
      back: () => router.back(),
      forward: () => router.forward(),
      prefetch: router.prefetch,
    }),
    [router, run]
  );
}

// True while any navigation started through useAppRouter is still loading, so a
// button can stay in its busy state until the next page actually appears.
export function useNavigationBusy(): boolean {
  return useSyncExternalStore(
    navigationBusy.subscribe,
    navigationBusy.getSnapshot,
    navigationBusy.getServerSnapshot
  );
}
