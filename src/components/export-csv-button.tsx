"use client";

import { useState } from "react";

import { ActionButton } from "@/components/action-button";

function fileNameFrom(disposition: string | null): string {
  return /filename="([^"]+)"/.exec(disposition ?? "")?.[1] ?? "tasks.csv";
}

// Builds the CSV on the server, which can take a moment for a big project: show
// a busy button meanwhile, then hand the file to the browser.
export function ExportCsvButton({ href }: { href: string }) {
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);

    try {
      const res = await fetch(href, { cache: "no-store" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string" ? body.error : "Could not export the tasks."
        );
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFrom(res.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ActionButton
        onClick={download}
        pendingLabel="Exporting…"
        className="btn-secondary rounded-xl px-3 py-1.5 text-sm"
      >
        Export CSV
      </ActionButton>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
