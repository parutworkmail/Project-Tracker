"use client";

import { useState } from "react";

import {
  LABEL_COLOR_LIST,
  LABEL_DOT_STYLES,
  type IssueLabelView,
  type LabelColor,
} from "@/lib/issueMeta";

const CONTROL =
  "rounded border border-black/[.08] bg-surface px-2 py-1.5 text-sm dark:border-white/[.145]";

export function LabelCreateForm({
  slug,
  onCreated,
}: {
  slug: string;
  onCreated: (label: IssueLabelView) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Give the label a name.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${slug}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Could not create the label."
        );
        return;
      }

      setName("");
      onCreated(data as IssueLabelView);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={30}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="New label"
          aria-label="New label name"
          className={`${CONTROL} w-40`}
        />
        <div role="radiogroup" aria-label="Label color" className="flex gap-1">
          {LABEL_COLOR_LIST.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={color === value}
              aria-label={value}
              onClick={() => setColor(value)}
              className={`h-5 w-5 rounded-full ${LABEL_DOT_STYLES[value]} ${
                color === value
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-[var(--background)]"
                  : "opacity-70 hover:opacity-100"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded border border-black/[.08] px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/[.145]"
        >
          {busy ? "Adding…" : "Add label"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
