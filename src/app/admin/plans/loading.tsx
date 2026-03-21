/**
 * src/app/admin/plans/loading.tsx
 *
 * Loading UI pour la page Gestion des plans — Next.js streaming.
 * Skeleton mimant le layout de PlansAdminList : cartes empilées mobile-first.
 *
 * Sprint 38 — Story 38.5
 * R6 : CSS variables du thème, pas de couleurs en dur
 */
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton d'une carte plan (mobile : full-width, desktop : colonne) */
function PlanCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* En-tête : nom du plan + badge statut */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Prix */}
      <div className="flex gap-2 flex-wrap">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Limites */}
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export default function AdminPlansLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-6 w-44" />
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Titre + compteur */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Bouton "Nouveau plan" */}
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Filtre tabs */}
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>

        {/* Liste des plans — cartes empilées mobile, grille desktop */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <PlanCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
