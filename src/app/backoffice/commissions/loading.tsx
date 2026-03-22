export default function BackofficeCommissionsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-4 w-40 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
