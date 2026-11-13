"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Matches the duration of --animate-fade-out / --animate-pop-out in globals.css.
const EXIT_MS = 180;

export function Dialog({
  open,
  onClose,
  title,
  children,
  hideClose = false,
  onExited,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  hideClose?: boolean;
  // Called once the exit animation has finished and the dialog is gone.
  onExited?: () => void;
}) {
  // Stay on screen for the exit animation after `open` turns false, then unmount.
  const [mounted, setMounted] = useState(open);
  const closing = !open && mounted;

  // Latest callback without making the exit timer restart when the parent re-renders.
  const onExitedRef = useRef(onExited);
  useEffect(() => {
    onExitedRef.current = onExited;
  });

  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!closing) return;

    const timer = setTimeout(() => {
      setMounted(false);
      onExitedRef.current?.();
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if ((!open && !mounted) || typeof document === "undefined") return null;

  // Rendered on <body>: inside a sticky/blurred header the fixed overlay would
  // be confined to that header instead of covering the screen.
  return createPortal(
    <div
      className={`${
        closing ? "animate-fade-out pointer-events-none" : "animate-fade-in"
      } fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${
          closing ? "animate-pop-out" : "animate-pop"
        } max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-black/[.08] bg-surface p-6 shadow-2xl shadow-slate-900/15 dark:border-white/[.12]`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-accent/12 hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
