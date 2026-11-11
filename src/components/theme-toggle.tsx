"use client";

import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/themeScript";

export type ThemePreference = "system" | "light" | "dark";

const CHANGE_EVENT = "theme-preference-change";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyPreference(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function handleSystemChange() {
    applyPreference(readPreference());
    onChange();
  }

  window.addEventListener("storage", handleSystemChange);
  window.addEventListener(CHANGE_EVENT, handleSystemChange);
  media.addEventListener("change", handleSystemChange);

  return () => {
    window.removeEventListener("storage", handleSystemChange);
    window.removeEventListener(CHANGE_EVENT, handleSystemChange);
    media.removeEventListener("change", handleSystemChange);
  };
}

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABELS: Record<ThemePreference, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

const ICONS: Record<ThemePreference, string> = {
  system: "M4 5h16v11H4zM9 20h6M12 16v4",
  light:
    "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  dark: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
};

export function ThemeToggle() {
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    () => "system" as ThemePreference
  );

  function cycle() {
    const next = NEXT[preference];
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    applyPreference(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABELS[preference]} (click to switch to ${LABELS[NEXT[preference]].toLowerCase()})`}
      title={LABELS[preference]}
      className="flex h-8 w-8 items-center justify-center rounded border border-black/[.08] text-zinc-600 hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/[.08]"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICONS[preference]} />
      </svg>
    </button>
  );
}
