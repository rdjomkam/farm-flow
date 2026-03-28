/**
 * alerte-helpers.ts — constantes et helpers partagés pour les alertes ingénieur.
 *
 * Utilisé par :
 *   - src/app/(ingenieur)/monitoring/page.tsx
 *   - src/components/ingenieur/ingenieur-dashboard-multi-farm.tsx
 *
 * R2 : import des enums depuis @/types
 */

import { TypeAlerte } from "@/types";

// ---------------------------------------------------------------------------
// Labels humains par type d'alerte
// ---------------------------------------------------------------------------

export const typeAlerteLabels: Record<string, string> = {
  [TypeAlerte.MORTALITE_ELEVEE]: "Mortalite elevee",
  [TypeAlerte.QUALITE_EAU]: "Qualite eau",
  [TypeAlerte.STOCK_BAS]: "Stock bas",
  [TypeAlerte.RAPPEL_ALIMENTATION]: "Alimentation",
  [TypeAlerte.RAPPEL_BIOMETRIE]: "Biometrie",
  [TypeAlerte.PERSONNALISEE]: "Personnalisee",
};

// ---------------------------------------------------------------------------
// Sévérité par type d'alerte
// ---------------------------------------------------------------------------

export type AlerteSeverite = "critique" | "attention" | "info";

export const severiteAlerte: Record<string, AlerteSeverite> = {
  [TypeAlerte.MORTALITE_ELEVEE]: "critique",
  [TypeAlerte.QUALITE_EAU]: "critique",
  [TypeAlerte.STOCK_BAS]: "attention",
  [TypeAlerte.RAPPEL_ALIMENTATION]: "info",
  [TypeAlerte.RAPPEL_BIOMETRIE]: "info",
  [TypeAlerte.PERSONNALISEE]: "info",
};

// ---------------------------------------------------------------------------
// Ordre de tri par sévérité (0 = plus critique)
// ---------------------------------------------------------------------------

export const severiteOrder: Record<AlerteSeverite, number> = {
  critique: 0,
  attention: 1,
  info: 2,
};

// ---------------------------------------------------------------------------
// Tri d'une liste d'alertes par sévérité décroissante
// ---------------------------------------------------------------------------

export function sortAlertesBySeverite<T extends { typeAlerte: string }>(
  alertes: T[]
): T[] {
  return [...alertes].sort((a, b) => {
    const sA = severiteOrder[severiteAlerte[a.typeAlerte] ?? "info"];
    const sB = severiteOrder[severiteAlerte[b.typeAlerte] ?? "info"];
    return sA - sB;
  });
}
