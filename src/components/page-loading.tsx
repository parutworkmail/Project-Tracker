export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col" role="status" aria-label={label}>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="skeleton mb-3 h-8 w-56" />
        <div className="skeleton mb-8 h-4 w-80 max-w-full" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton h-16 w-full" />
          ))}
        </div>
      </main>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
