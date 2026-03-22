/**
 * src/app/backoffice/dashboard/loading.tsx
 *
 * Skeleton de chargement du dashboard backoffice.
 * Story C.5 — ADR-022 Backoffice
 */

export default function BackofficeDashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6 space-y-2">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-4 w-64 rounded bg-muted" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-40 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
