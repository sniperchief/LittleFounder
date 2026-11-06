/** Loading placeholder for parent-area pages while session data streams in. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-6xl animate-pulse px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-9 w-64 rounded-lg bg-muted" />
      <div className="mt-3 h-5 w-96 max-w-full rounded-lg bg-muted" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 rounded-xl border-2 border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
