"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectSearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed === initialQuery) return;

      const url = trimmed
        ? `/dashboard?q=${encodeURIComponent(trimmed)}`
        : "/dashboard";
      router.push(url);
    }, 300);

    return () => clearTimeout(handle);
  }, [value, initialQuery, router]);

  return (
    <div
      className="animate-fade-up relative mb-6"
      style={{ animationDelay: "80ms" }}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search projects by name…"
        aria-label="Search projects"
        className="surface w-full rounded-2xl py-3 pl-11 pr-4 text-sm shadow-sm"
      />
    </div>
  );
}
