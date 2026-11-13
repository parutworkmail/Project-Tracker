import { formatVersion, RELEASE_STAGE } from "@/lib/appVersion";

export function SiteFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  const commit = process.env.NEXT_PUBLIC_APP_COMMIT || undefined;

  return (
    <footer className="mt-auto border-t border-black/[.06] px-6 py-4 text-center text-xs text-muted dark:border-white/[.08]">
      <span>Developed by Parut Na</span>
      <span aria-hidden="true" className="mx-2">
        ·
      </span>
      <span
        title="The version of this website that is running right now"
        className="inline-flex items-center gap-1.5 rounded-full border border-black/[.1] px-2 py-0.5 font-mono dark:border-white/[.15]"
      >
        {formatVersion(version, commit)}
        <span className="rounded bg-yellow-200/80 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-800 dark:bg-yellow-300/20 dark:text-yellow-200">
          {RELEASE_STAGE}
        </span>
      </span>
    </footer>
  );
}
