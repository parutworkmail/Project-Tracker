"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { Dialog } from "@/components/dialog";
import { ActionButton } from "@/components/action-button";

export function SignOutButton() {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function confirm() {
    setSigningOut(true);

    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-black/[.08] px-3 py-1.5 dark:border-white/[.145]"
      >
        Sign out
      </button>

      <Dialog
        open={open}
        onClose={() => {
          if (!signingOut) setOpen(false);
        }}
        title="Sign out?"
        hideClose
      >
        <p className="text-sm text-muted">
          You will need to log in again to get back to your projects.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={signingOut}
            className="btn-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <ActionButton
            onClick={confirm}
            pending={signingOut}
            pendingLabel="Signing out..."
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Sign out
          </ActionButton>
        </div>
      </Dialog>
    </>
  );
}
