import { ProjectListSkeleton } from "@/components/project-list-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="skeleton mb-8 h-44 w-full rounded-3xl" />
        <div className="skeleton mb-6 h-12 w-full rounded-xl" />
        <ProjectListSkeleton />
      </main>
    </div>
  );
}
