/**
 * src/app/mon-portefeuille/loading.tsx
 *
 * Loading UI pour la page Mon Portefeuille — Next.js streaming.
 * Utilise les skeletons de skeleton-patterns.tsx.
 *
 * Sprint 37 — Story 37.2
 */
import { KPICardSkeleton, ListItemSkeleton } from "@/components/ui/skeleton-patterns";
import { Skeleton } from "@/components/ui/skeleton";

export default function MonPortefeuilleLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-6 w-36" />
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Résumé portefeuille skeleton */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 gap-3">
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </div>
          <Skeleton className="h-[44px] w-full rounded-lg" />
        </div>

        {/* Commissions skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          {/* Tabs skeleton */}
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>

        {/* Retraits skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-44" />
          {[1, 2].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
