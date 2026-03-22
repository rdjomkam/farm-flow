export default function BackofficeModulesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-6 w-44 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-36 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
            <div className="h-6 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
