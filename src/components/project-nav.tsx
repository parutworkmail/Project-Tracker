"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

import { Avatar } from "@/components/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

export function ProjectNav({
  slug,
  name,
  active,
  canManage,
}: {
  slug: string;
  name: string;
  active: "settings" | "board";
  canManage: boolean;
}) {
  const { data: session, status } = useSession();
  const username = session?.user?.username ?? "";

  return (
    <header className="glass sticky top-0 z-40 mb-6 flex items-center justify-between border-b border-black/[.06] px-6 py-3 dark:border-white/[.08]">
      <Link
        href={`/${slug}/board`}
        className="group flex min-w-0 items-center gap-3"
      >
        <Avatar name={name} seed={slug} size={38} />
        <span
          className={
            active === "board"
              ? "gradient-text truncate text-xl font-semibold tracking-tight"
              : "truncate text-xl font-semibold tracking-tight group-hover:text-foreground dark:group-hover:text-accent-text"
          }
        >
          {name}
        </span>
      </Link>

      <div className="flex items-center gap-2 text-sm">
        <ThemeToggle />
        {canManage && (
          <Link
            href={`/${slug}/settings`}
            className={
              active === "settings"
                ? "rounded-lg bg-accent/45 px-3 py-1.5 font-medium text-foreground dark:bg-accent/20 dark:text-accent-text"
                : "rounded-lg px-3 py-1.5 text-muted hover:bg-accent/12 hover:text-foreground"
            }
          >
            Settings
          </Link>
        )}
        <Link
          href="/dashboard"
          className="rounded-lg px-3 py-1.5 text-muted hover:bg-accent/12 hover:text-foreground"
        >
          Dashboard
        </Link>
        {status === "authenticated" && (
          <>
            <span className="ml-1 flex items-center gap-2 rounded-full border border-black/[.06] py-1 pl-1 pr-3 dark:border-white/[.1]">
              <Avatar
                name={username || "?"}
                size={26}
                rounded="rounded-full"
              />
              <span className="text-muted">{username}</span>
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-black/[.08] px-3 py-1.5 dark:border-white/[.145]"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
