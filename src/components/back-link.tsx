import Link from "next/link";

export function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:underline"
    >
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
