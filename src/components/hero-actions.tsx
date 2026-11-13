"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function HeroActions() {
  const { status } = useSession();

  // Until the session is known we cannot tell signed in from signed out, so show
  // a placeholder instead of guessing (guessing flashed Log in to signed-in users).
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label="Checking your session"
        className="skeleton h-14 w-48 rounded-xl"
      />
    );
  }

  if (status === "authenticated") {
    return (
      <Link
        href="/dashboard"
        className="btn-hero animate-fade-in rounded-xl bg-foreground px-10 py-4 text-base text-background"
      >
        Go to dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="btn-hero animate-fade-in rounded-xl bg-foreground px-10 py-4 text-base text-background"
      >
        Log in
      </Link>
      <Link
        href="/join"
        className="btn-secondary animate-fade-in rounded-xl px-7 py-3 text-sm"
      >
        Join us
      </Link>
    </>
  );
}
