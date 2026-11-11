export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="skeleton mb-6 h-16 w-full rounded-none" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="skeleton mb-4 h-8 w-40" />
        <div className="skeleton mb-4 h-11 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton h-14 w-full" />
          ))}
        </div>
      </main>
    </div>
  );
}
