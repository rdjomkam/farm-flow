/**
 * src/app/mon-abonnement/loading.tsx
 *
 * Loading UI pour la page Mon Abonnement — Next.js streaming.
 * Utilise les skeletons de skeleton-patterns.tsx.
 *
 * Sprint 37 — Story 37.2
 */
import { KPICardSkeleton, ListItemSkeleton } from "@/components/ui/skeleton-patterns";
import { Skeleton } from "@/components/ui/skeleton";

export default function MonAbonnementLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-6 w-40" />
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Abonnement actuel card skeleton */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <KPICardSkeleton />
            <KPICardSkeleton />
          </div>
          <Skeleton className="h-[44px] w-full rounded-lg" />
        </div>

        {/* Historique paiements skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          {[1, 2, 3].map((i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
