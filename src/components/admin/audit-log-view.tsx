import Link from "next/link";
import Form from "next/form";

import { LocalTime } from "@/components/local-time";
import {
  AUDIT_CATEGORIES,
  AUDIT_LEVELS,
  type AuditPage,
  type AuditQuery,
} from "@/lib/audit";

const LEVEL_STYLES: Record<string, string> = {
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  WARN: "bg-yellow-200 text-yellow-950 dark:bg-yellow-400/25 dark:text-yellow-100",
  INFO: "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200",
};

const FIELD =
  "rounded border border-black/[.08] bg-surface px-2 py-1.5 text-sm dark:border-white/[.145]";

function pageHref(query: AuditQuery, page: number): string {
  const params = new URLSearchParams();

  if (query.level) params.set("level", query.level);
  if (query.category) params.set("category", query.category);
  if (query.q) params.set("q", query.q);
  if (page > 1) params.set("page", String(page));

  const text = params.toString();
  return `/admin/logs${text ? `?${text}` : ""}`;
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl bg-black/[.035] px-5 py-3 dark:bg-white/[.05]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${tone ?? "text-foreground/70"}`}>{value}</p>
    </div>
  );
}

export function AuditLogView({ data, query }: { data: AuditPage; query: AuditQuery }) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filtered = Boolean(query.level || query.category || query.q);

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Tile
          label="Errors, last 24 h"
          value={data.errorsLast24h}
          tone={data.errorsLast24h > 0 ? "text-red-600" : undefined}
        />
        <Tile label="Warnings, last 24 h" value={data.warningsLast24h} />
        <Tile label={filtered ? "Matching entries" : "Entries"} value={data.total} />
      </div>

      <Form action="/admin/logs" className="mb-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="log-q">
          Search the log
        </label>
        <input
          id="log-q"
          name="q"
          type="search"
          defaultValue={query.q ?? ""}
          placeholder="Search message, user, project, address…"
          className={`${FIELD} min-w-56 flex-1`}
        />
        <label className="sr-only" htmlFor="log-level">
          Level
        </label>
        <select id="log-level" name="level" defaultValue={query.level ?? ""} className={FIELD}>
          <option value="">All levels</option>
          {AUDIT_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="log-category">
          Category
        </label>
        <select
          id="log-category"
          name="category"
          defaultValue={query.category ?? ""}
          className={FIELD}
        >
          <option value="">All categories</option>
          {AUDIT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background"
        >
          Apply
        </button>
        {filtered && (
          <Link href="/admin/logs" className="text-sm text-muted hover:underline">
            Clear
          </Link>
        )}
      </Form>

      {data.rows.length === 0 ? (
        <p className="surface rounded-2xl p-8 text-center text-sm text-muted">
          {filtered ? "No entries match these filters." : "Nothing has been logged yet."}
        </p>
      ) : (
        <div className="surface overflow-x-auto rounded-2xl">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/[.06] bg-accent/[.08] text-left text-xs uppercase tracking-wide text-muted dark:border-white/[.08]">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">What happened</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-black/[.06] align-top last:border-b-0 dark:border-white/[.08]"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    <LocalTime iso={row.createdAt.toISOString()} />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        LEVEL_STYLES[row.level] ?? LEVEL_STYLES.INFO
                      }`}
                    >
                      {row.level}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.actorName ?? <span className="text-muted">system</span>}
                    {row.ip && <span className="block text-xs text-muted">{row.ip}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <p className="break-words">{row.message}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.category} · {row.action}
                      {row.target ? ` · ${row.target}` : ""}
                    </p>
                    {row.meta !== null && row.meta !== undefined && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-muted">Details</summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/[.04] p-2 dark:bg-white/[.06]">
                          {JSON.stringify(row.meta, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Log pages"
          className="mt-4 flex items-center justify-between text-sm text-muted"
        >
          {data.page <= 1 ? (
            <span aria-disabled="true" className="opacity-40">
              ← Newer
            </span>
          ) : (
            <Link href={pageHref(query, data.page - 1)} className="hover:underline">
              ← Newer
            </Link>
          )}
          <span>
            Page {data.page} of {totalPages}
          </span>
          {data.page >= totalPages ? (
            <span aria-disabled="true" className="opacity-40">
              Older →
            </span>
          ) : (
            <Link href={pageHref(query, data.page + 1)} className="hover:underline">
              Older →
            </Link>
          )}
        </nav>
      )}

      <p className="mt-8 rounded-xl bg-black/[.035] p-4 text-xs text-muted dark:bg-white/[.05]">
        Entries older than 90 days are removed automatically. Errors that happen while the
        database itself is unreachable cannot be saved here, because this log lives in that
        database. Those only appear in the server logs of your hosting provider (on Vercel:
        your project, then Logs).
      </p>
    </div>
  );
}
