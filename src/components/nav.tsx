"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { Avatar } from "@/components/avatar";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

const DB_RECHECK_MS = 8000;

function menuLinkClass(active: boolean) {
  return active
    ? "rounded-lg bg-accent/45 px-3 py-1.5 font-medium text-foreground dark:bg-accent/20 dark:text-accent-text"
    : "rounded-lg px-3 py-1.5 text-muted hover:bg-accent/12 hover:text-foreground";
}

export function Nav() {
  const { data: session, status, update } = useSession();
  // Right after signing in, the session updates before the login page has left
  // the screen; keep the account area hidden there instead of flashing it.
  const pathname = usePathname();
  const onLoginPage = pathname === "/login";
  const dbUnavailable =
    status === "authenticated" && Boolean(session.user?.dbUnavailable);

  // Heal on its own: while the database is down, re-check the session every
  // few seconds so the banner disappears as soon as the connection is back.
  useEffect(() => {
    if (!dbUnavailable) return;

    const timer = setInterval(() => {
      void update();
    }, DB_RECHECK_MS);

    return () => clearInterval(timer);
  }, [dbUnavailable, update]);

  const username = session?.user?.username ?? "";
  const showAccount = status === "authenticated" && !onLoginPage;
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  return (
    <>
      {dbUnavailable && (
        <div
          role="alert"
          className="animate-fade-in bg-gradient-to-r from-red-700 to-red-600 px-4 py-2 text-center text-sm text-white"
        >
          Database is currently unavailable. Some features may not work
          correctly until the connection is restored. Retrying automatically…
        </div>
      )}
      <header className="glass sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-black/[.06] px-6 py-3 dark:border-white/[.08]">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="group flex items-center gap-3 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-200 to-yellow-400 text-on-accent shadow-lg shadow-yellow-500/25 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12l4 4L19 6" />
              </svg>
            </span>
            <span className="tracking-tight">Project Tracker</span>
          </Link>

          {showAccount && (
            <nav aria-label="Main menu" className="flex items-center gap-1 text-sm">
              <Link href="/my-tasks" className={menuLinkClass(pathname === "/my-tasks")}>
                My tasks
              </Link>
              {isSuperAdmin && (
                <>
                  <Link
                    href="/admin"
                    className={menuLinkClass(
                      pathname === "/admin" ||
                        (pathname.startsWith("/admin/") &&
                          !pathname.startsWith("/admin/logs"))
                    )}
                  >
                    Admin console
                  </Link>
                  <Link
                    href="/admin/logs"
                    className={menuLinkClass(pathname.startsWith("/admin/logs"))}
                  >
                    Audit log
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <ThemeToggle />
          {showAccount ? (
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
          ) : status === "authenticated" || status === "loading" ? null : (
            <Link
              href="/login"
              className="rounded-lg bg-foreground px-4 py-1.5 text-background"
            >
              Log in
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
