"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Empty on the server so nothing is flagged overdue until the browser knows
// the user's local calendar date.
export function useToday(): string {
  return useSyncExternalStore(subscribe, localToday, () => "");
}
