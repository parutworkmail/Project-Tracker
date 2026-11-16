"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { Avatar } from "@/components/avatar";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UnreadBadge } from "@/components/unread-badge";

// Which part of the project is open, read from the address so this component can
// live in a shared layout and keep its state while the page underneath changes.
function activeSection(pathname: string): "settings" | "board" | "my-tasks" {
  const section = pathname.split("/")[2];

  if (section === "settings") return "settings";
  if (section === "my-tasks") return "my-tasks";
  return "board";
}

export function ProjectNav({
  slug,
  name,
  unread,
}: {
  slug: string;
  name: string;
  unread: number;
}) {
  const active = activeSection(usePathname());
  const { data: session, status } = useSession();
  const username = session?.user?.username ?? "";

  return (
    <header className="glass sticky top-0 z-40 mb-6 flex items-center justify-between gap-4 border-b border-black/[.06] px-6 py-3 dark:border-white/[.08]">
      <div className="flex min-w-0 items-center gap-4">
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

        <nav aria-label="Project menu" className="flex items-center gap-1 text-sm">
          <Link
            href={`/${slug}/my-tasks`}
            className={
              active === "my-tasks"
                ? "rounded-lg bg-accent/45 px-3 py-1.5 font-medium text-foreground dark:bg-accent/20 dark:text-accent-text"
                : "rounded-lg px-3 py-1.5 text-muted hover:bg-accent/12 hover:text-foreground"
            }
          >
            My tasks
            <UnreadBadge slug={slug} initial={unread} />
          </Link>
          <Link
            href={`/${slug}/settings`}
            className={
              active === "settings"
                ? "rounded-lg bg-accent/45 px-3 py-1.5 font-medium text-foreground dark:bg-accent/20 dark:text-accent-text"
                : "rounded-lg px-3 py-1.5 text-muted hover:bg-accent/12 hover:text-foreground"
            }
          >
            Project Settings
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/dashboard"
          className="rounded-lg px-3 py-1.5 text-muted hover:bg-accent/12 hover:text-foreground"
        >
          All projects
        </Link>
        <ThemeToggle />
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
            <SignOutButton />
          </>
        )}
      </div>
    </header>
  );
}
