"use client";

import { useGlobalLoading } from "@/contexts/global-loading.context";
import { FishLoader } from "@/components/ui/fish-loader";
import { useTranslations } from "next-intl";

/**
 * LoadingOverlay — Overlay plein ecran bloquant.
 *
 * Apparait des qu'au moins une requete API (via useApi) est en cours.
 * Bloque toute interaction utilisateur pendant le chargement.
 * Les requetes silencieuses (polling notifications) ne declenchent PAS cet overlay.
 *
 * Design :
 * - Fixed inset-0 — couvre toute la page
 * - z-[9999] — au-dessus de tout (dialogs Radix, header, etc.)
 * - Fond semi-transparent avec blur
 * - FishLoader lg centre
 *
 * Placement dans layout.tsx :
 *   <GlobalLoadingProvider>
 *     <LoadingOverlay />
 *     {children}
 *   </GlobalLoadingProvider>
 */
export function LoadingOverlay() {
  // Ne s'affiche QUE pour les mutations bloquantes, pas pour la navigation
  const { isMutating } = useGlobalLoading();
  const t = useTranslations("common");

  if (!isMutating) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      aria-busy="true"
      aria-label={t("loading.ariaLabel")}
    >
      <FishLoader size="lg" text={t("loading.text")} />
    </div>
  );
}
