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
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search projects by name…"
      className="mb-4 w-full rounded border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black"
    />
  );
}
