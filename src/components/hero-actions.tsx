"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function HeroActions() {
  const { status } = useSession();

  if (status === "authenticated") {
    return (
      <Link
        href="/dashboard"
        className="btn-hero rounded-xl bg-foreground px-10 py-4 text-base text-background"
      >
        Go to dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="btn-hero rounded-xl bg-foreground px-10 py-4 text-base text-background"
      >
        Log in
      </Link>
      <Link href="/join" className="btn-secondary rounded-xl px-7 py-3 text-sm">
        Join us
      </Link>
    </>
  );
}
