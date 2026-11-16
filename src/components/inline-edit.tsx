"use client";

import { useRef, useState } from "react";

type FieldEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

const FIELD =
  "w-full rounded border border-black/[.08] bg-surface px-3 py-2 dark:border-white/[.145]";

// Reads as plain text; click (or Enter/Space on it) turns it into an input.
// Enter (Ctrl/Cmd+Enter for multi-line) or clicking away goes back to reading
// mode and keeps the typed value; Escape throws the edit away. The parent owns
// the value and decides when to save.
export function InlineEdit({
  label,
  value,
  onChange,
  multiline = false,
  maxLength,
  placeholder,
  displayClassName = "",
  inputClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength?: number;
  placeholder: string;
  displayClassName?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const before = useRef(value);

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label.toLowerCase()}`}
        onClick={() => {
          before.current = value;
          setEditing(true);
        }}
        className={`-mx-3 block w-[calc(100%+1.5rem)] rounded px-3 py-1.5 text-left hover:bg-black/[.04] dark:hover:bg-white/[.06] ${displayClassName}`}
      >
        {value ? (
          <span className="whitespace-pre-wrap break-words">{value}</span>
        ) : (
          <span className="text-zinc-500">{placeholder}</span>
        )}
      </button>
    );
  }

  const shared = {
    autoFocus: true,
    "aria-label": label,
    value,
    maxLength,
    placeholder,
    className: `${FIELD} ${inputClassName}`,
    onChange: (e: FieldEvent) => onChange(e.target.value),
    onBlur: () => setEditing(false),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const end = e.currentTarget.value.length;
      e.currentTarget.setSelectionRange(end, end);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onChange(before.current);
        setEditing(false);
      } else if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setEditing(false);
      }
    },
  };

  return multiline ? (
    <textarea rows={6} {...shared} />
  ) : (
    <input type="text" {...shared} />
  );
}
