export default function BackofficeAbonnementsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-pulse">
      <div className="mb-4 space-y-2">
        <div className="h-6 w-44 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
