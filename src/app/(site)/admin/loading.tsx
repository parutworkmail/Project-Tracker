export default function Loading() {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-label="Loading admin console">
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <div className="skeleton mb-4 h-5 w-40" />
        <div className="skeleton mb-8 h-8 w-56" />

        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <div className="skeleton h-6 w-20" />
            <div className="skeleton h-7 w-24" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton h-14 w-full" />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="skeleton mb-4 h-6 w-24" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton h-20 w-full" />
            ))}
          </div>
        </section>

        <section>
          <div className="skeleton mb-2 h-6 w-64" />
          <div className="skeleton mb-4 h-4 w-80" />
          <div className="skeleton h-32 w-full" />
        </section>
      </main>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
