"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () =>
      new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    () => iso.slice(0, 10)
  );

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
