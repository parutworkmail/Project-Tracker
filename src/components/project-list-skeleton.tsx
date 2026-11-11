export function ProjectListSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading projects"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="surface animate-fade-up rounded-2xl p-5"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <div className="flex items-center gap-4">
            <div className="skeleton h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <div className="skeleton h-5 w-16 rounded-full" />
            <div className="skeleton h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
