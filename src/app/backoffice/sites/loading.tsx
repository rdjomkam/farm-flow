/**
 * src/app/backoffice/sites/loading.tsx
 * Story C.6 — ADR-022 Backoffice
 */

export default function BackofficeSitesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-6 w-52 rounded bg-muted" />
        <div className="h-4 w-40 rounded bg-muted" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-8 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="h-10 rounded-lg bg-muted mb-4" />

      {/* List */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
