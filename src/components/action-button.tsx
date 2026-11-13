"use client";

import { useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";

type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  // Show the busy state from outside (e.g. a form's isSubmitting).
  pending?: boolean;
  // Text shown while busy; defaults to the normal label.
  pendingLabel?: ReactNode;
  // May return a promise: the button then stays busy until it settles.
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
};

// One button for every action that waits on the server: it disables itself,
// shows a spinner and announces the busy state to screen readers.
export function ActionButton({
  pending = false,
  pendingLabel,
  onClick,
  disabled,
  children,
  className = "",
  type = "button",
  ...rest
}: ActionButtonProps) {
  const [running, setRunning] = useState(false);
  const busy = pending || running;

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!onClick || busy) return;

    const result = onClick(event);

    if (result && typeof result.then === "function") {
      setRunning(true);

      try {
        await result;
      } finally {
        setRunning(false);
      }
    }
  }

  return (
    <button
      {...rest}
      type={type}
      onClick={type === "submit" && !onClick ? undefined : handleClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className={`inline-flex items-center justify-center gap-2 disabled:opacity-60 ${className}`}
    >
      {busy && <span className="btn-spinner" aria-hidden="true" />}
      {busy && pendingLabel !== undefined ? pendingLabel : children}
    </button>
  );
}
