export default function BackofficePlansLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-pulse">
      <div className="mb-4 space-y-2">
        <div className="h-6 w-44 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-8 w-24 rounded bg-muted" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-3 w-full rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
