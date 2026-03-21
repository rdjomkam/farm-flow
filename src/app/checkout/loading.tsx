/**
 * src/app/checkout/loading.tsx
 *
 * Loading UI pour la page checkout — Next.js streaming.
 * Utilise les skeletons de skeleton-patterns.tsx.
 *
 * Sprint 37 — Story 37.2
 */
import { KPICardSkeleton, ListItemSkeleton } from "@/components/ui/skeleton-patterns";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-6 w-32" />
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Stepper skeleton */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 w-16 mt-1 hidden sm:block" />
              </div>
              {i < 3 && <Skeleton className="h-0.5 flex-1 mx-1" />}
            </div>
          ))}
        </div>

        {/* Card skeleton */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[52px] w-full rounded-lg" />
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <Skeleton className="h-[44px] w-full rounded-lg" />
        </div>

        {/* KPI summaries */}
        <div className="grid grid-cols-2 gap-3">
          <KPICardSkeleton />
          <KPICardSkeleton />
        </div>

        {/* List items */}
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
