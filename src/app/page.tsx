import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Project Tracker
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          A JIRA-like project tracker. Create a project, share the link, and
          track issues with your team.
        </p>
        <Link
          href="/dashboard"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
        >
          Go to dashboard
        </Link>
      </main>
    </div>
  );
}
