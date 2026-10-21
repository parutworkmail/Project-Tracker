"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function GoogleSignInButton() {
  const [isRedirecting, setIsRedirecting] = useState(false);

  return (
    <>
      <div className="my-4 flex items-center gap-2 text-sm text-zinc-500">
        <div className="h-px flex-1 bg-black/[.08] dark:bg-white/[.145]" />
        or
        <div className="h-px flex-1 bg-black/[.08] dark:bg-white/[.145]" />
      </div>

      <button
        type="button"
        disabled={isRedirecting}
        onClick={() => {
          setIsRedirecting(true);
          signIn("google", { callbackUrl: "/" }).catch(() => {
            setIsRedirecting(false);
          });
        }}
        className="w-full rounded border border-black/[.08] px-4 py-2 disabled:opacity-50 dark:border-white/[.145]"
      >
        {isRedirecting ? "Redirecting..." : "Continue with Google"}
      </button>
    </>
  );
}
