"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function Nav() {
  const { data: session, status } = useSession();

  return (
    <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.145]">
      <Link href="/" className="font-semibold">
        Project Tracker
      </Link>

      <nav className="flex items-center gap-4 text-sm">
        {status === "authenticated" ? (
          <>
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <span className="text-zinc-500">{session.user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded border border-black/[.08] px-3 py-1 dark:border-white/[.145]"
            >
              Sign out
            </button>
          </>
        ) : status === "loading" ? null : (
          <>
            <Link href="/login" className="hover:underline">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded bg-foreground px-3 py-1 text-background"
            >
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
