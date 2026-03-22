/**
 * src/app/backoffice/sites/[id]/loading.tsx
 * Story C.6 — ADR-022 Backoffice
 */

export default function BackofficeSiteDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-32 rounded bg-muted mb-6" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-6 rounded bg-muted" />
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>

      {/* Tabs */}
      <div className="h-10 rounded-lg bg-muted mb-6" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-7 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Info rows */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
