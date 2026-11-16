import type { ReactNode } from "react";

interface CollapsibleProps {
  // Always visible: shown on the closed bar and next to the chevron when open.
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  // "box": bordered dropdown with a divider before the content.
  // "plain": a text-sized toggle for secondary actions inside another panel.
  variant?: "box" | "plain";
  className?: string;
}

const CHEVRON = (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Native <details>, so it works without client JS, is keyboard accessible, and
// can be used from both server and client components.
export function Collapsible({
  summary,
  children,
  defaultOpen = false,
  variant = "box",
  className = "",
}: CollapsibleProps) {
  if (variant === "plain") {
    return (
      <details open={defaultOpen} className={`group text-sm ${className}`}>
        <summary className="flex cursor-pointer list-none items-center gap-1 text-zinc-500 hover:underline [&::-webkit-details-marker]:hidden">
          {summary}
          {CHEVRON}
        </summary>
        <div className="mt-2">{children}</div>
      </details>
    );
  }

  return (
    <details
      open={defaultOpen}
      className={`group rounded border border-black/[.08] bg-surface dark:border-white/[.145] ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">{summary}</span>
        {CHEVRON}
      </summary>
      <div className="border-t border-black/[.08] px-3 py-3 dark:border-white/[.145]">
        {children}
      </div>
    </details>
  );
}
