"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

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

  return (
    <header className="mb-6 flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.145]">
      <Link
        href={`/${slug}/board`}
        className={
          active === "board"
            ? "text-2xl font-semibold underline"
            : "text-2xl font-semibold hover:underline"
        }
      >
        {name}
      </Link>

      <div className="flex items-center gap-4 text-sm">
        {canManage && (
          <Link
            href={`/${slug}/settings`}
            className={
              active === "settings"
                ? "font-medium underline"
                : "text-zinc-500 hover:underline"
            }
          >
            Settings
          </Link>
        )}
        <Link href="/dashboard" className="text-zinc-500 hover:underline">
          Dashboard
        </Link>
        {status === "authenticated" && (
          <>
            <span className="text-zinc-500">{session.user?.username}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded border border-black/[.08] px-3 py-1 dark:border-white/[.145]"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
