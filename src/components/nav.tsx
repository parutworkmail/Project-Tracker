"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function Nav() {
  const { data: session, status } = useSession();

  return (
    <>
      {status === "authenticated" && session.user?.dbUnavailable && (
        <div
          role="alert"
          className="bg-red-600 px-4 py-2 text-center text-sm text-white"
        >
          Database is currently unavailable. Some features may not work
          correctly until the connection is restored.
        </div>
      )}
      <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.145]">
        <Link href="/" className="font-semibold">
          Project Tracker
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {status === "authenticated" ? (
            <>
              {session.user?.role === "SUPER_ADMIN" && (
                <>
                  <Link href="/dashboard" className="hover:underline">
                    Admin Dashboard
                  </Link>
                  <Link href="/admin" className="hover:underline">
                    Admin
                  </Link>
                </>
              )}
              <span className="text-zinc-500">{session.user?.username}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded border border-black/[.08] px-3 py-1 dark:border-white/[.145]"
              >
                Sign out
              </button>
            </>
          ) : status === "loading" ? null : (
            <Link href="/login" className="hover:underline">
              Log in
            </Link>
          )}
        </nav>
      </header>
    </>
  );
}
