"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h2 className="text-xl font-semibold">Something went wrong.</h2>
      <p className="text-sm text-zinc-500">
        An unexpected error occurred. Try again, or go back home.
      </p>
      <button
        onClick={() => retry()}
        className="rounded bg-foreground px-4 py-2 text-sm text-background"
      >
        Try again
      </button>
    </div>
  );
}
