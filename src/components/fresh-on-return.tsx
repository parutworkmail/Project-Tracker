"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";

// Next.js keeps a page you navigated away from mounted (hidden) and shows it
// again on return, so typed values and component state would survive. Effects
// are cleaned up when the page is hidden, which is the moment to throw the
// children away and start over.
export function FreshOnReturn({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    return () => setGeneration((value) => value + 1);
  }, []);

  return <Fragment key={generation}>{children}</Fragment>;
}
