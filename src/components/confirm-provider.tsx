"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Dialog } from "@/components/dialog";

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // "danger" makes the confirm button red (deletes, removals).
  tone?: "danger" | "default";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Replaces window.confirm everywhere: `if (!(await confirm({...}))) return;`
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);

  if (!confirm) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>.");
  }

  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  // `options` outlives `open` so the text does not vanish during the fade-out.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((answer: boolean) => void) | null>(null);

  const settle = useCallback((answer: boolean) => {
    resolver.current?.(answer);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback<ConfirmFn>(
    (next) =>
      new Promise<boolean>((resolve) => {
        // A second request while one is open counts as "no" for the first.
        resolver.current?.(false);
        resolver.current = resolve;
        setOptions(next);
        setOpen(true);
      }),
    []
  );

  const value = useMemo(() => confirm, [confirm]);
  const danger = (options?.tone ?? "default") === "danger";

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <Dialog
        open={open}
        onClose={() => settle(false)}
        onExited={() => setOptions(null)}
        title={options?.title ?? ""}
        hideClose
      >
        <div className="flex flex-col gap-5">
          <div className="text-sm text-muted">{options?.message}</div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => settle(false)}
              className="btn-secondary rounded-xl px-4 py-2 text-sm"
            >
              {options?.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              className={
                danger
                  ? "rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  : "rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
              }
            >
              {options?.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
