"use client";

import { useGlobalLoading } from "@/contexts/global-loading.context";

/**
 * GlobalLoadingBar — Barre de progression indéterminée en haut de page.
 *
 * Apparaît dès qu'au moins une requête API (via useApi) est en cours.
 * Disparaît quand toutes les requêtes sont terminées.
 *
 * Design :
 * - 2px de hauteur — discret, non-intrusif
 * - Position fixed top-0 — au-dessus du header
 * - z-index 200 — au-dessus de tout sauf les modals Radix (z-50 par défaut)
 * - Animation indéterminée (pas de valeur de progression réelle)
 * - Couleur var(--primary)
 *
 * Les boutons et formulaires conservent leur propre FishLoader sm pour le
 * feedback immédiat et pour gérer `disabled`. Cette barre est complémentaire.
 *
 * Placement dans layout.tsx :
 *   <GlobalLoadingProvider>
 *     <GlobalLoadingBar />
 *     {children}
 *   </GlobalLoadingProvider>
 */
export function GlobalLoadingBar() {
  const { isLoading } = useGlobalLoading();

  if (!isLoading) return null;

  return (
    <div
      role="progressbar"
      aria-label="Chargement en cours"
      aria-valuetext="Chargement..."
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 right-0 z-[200] h-0.5 overflow-hidden bg-primary/20"
    >
      <div className="h-full bg-primary animate-loading-bar" />
    </div>
  );
}
