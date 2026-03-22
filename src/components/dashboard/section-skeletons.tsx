/**
 * Skeleton fallbacks for dashboard Suspense boundaries.
 * Each skeleton roughly matches the height and layout of its real component.
 * Uses animate-pulse bg-muted for the pulse animation.
 */

export function HeroSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Hero greeting skeleton */}
      <div className="rounded-2xl p-6 animate-pulse bg-muted h-[108px]" />

      {/* StatsCards skeleton — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-muted animate-pulse h-[88px]" />
        ))}
      </div>

      {/* Vagues en cours skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-muted animate-pulse h-[120px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function IndicateursSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-3 w-40 rounded bg-muted animate-pulse" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-muted animate-pulse h-[220px]" />
        ))}
      </div>
    </div>
  );
}

export function ProjectionsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-muted animate-pulse h-[200px]" />
        ))}
      </div>
    </div>
  );
}

export function RecentActivitySkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-3 w-36 rounded bg-muted animate-pulse" />
      <div className="rounded-xl bg-muted animate-pulse h-[200px]" />
    </div>
  );
}
