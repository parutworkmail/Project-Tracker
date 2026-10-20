import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h2 className="text-xl font-semibold">Not found</h2>
      <p className="text-sm text-zinc-500">
        The page or project you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="rounded bg-foreground px-4 py-2 text-sm text-background"
      >
        Go home
      </Link>
    </div>
  );
}
