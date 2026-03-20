/**
 * density-thresholds.ts — Seuils de densite partages entre les API routes et les composants.
 *
 * Centralise les seuils par defaut par type de systeme (kg/m3) et la fonction
 * d'evaluation du statut de densite.
 *
 * Utilise dans :
 *   - src/app/api/bacs/[id]/densite/route.ts
 *   - src/app/api/vagues/[id]/densites/route.ts
 *   - src/components/bacs/bac-densite-badge.tsx
 */

import { TypeSystemeBac } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatutDensite = "OK" | "ALERTE" | "CRITIQUE" | "INCONNU";

export interface SeuilsDensite {
  alerte: number;
  critique: number;
}

export interface ConfigSeuilsDensite {
  densiteBacBetonAlerte?: number;
  densiteBacBetonCritique?: number;
  densiteEtangAlerte?: number;
  densiteEtangCritique?: number;
  densiteRasAlerte?: number;
  densiteRasCritique?: number;
}

// ---------------------------------------------------------------------------
// Seuils par defaut par type de systeme (kg/m3) — ADR §5.7
// ---------------------------------------------------------------------------

export const SEUILS_PAR_SYSTEME: Record<string, SeuilsDensite> = {
  [TypeSystemeBac.BAC_BETON]: { alerte: 150, critique: 200 },
  [TypeSystemeBac.BAC_PLASTIQUE]: { alerte: 150, critique: 200 },
  [TypeSystemeBac.ETANG_TERRE]: { alerte: 30, critique: 40 },
  [TypeSystemeBac.RAS]: { alerte: 350, critique: 500 },
};

// ---------------------------------------------------------------------------
// Fonction utilitaire principale
// ---------------------------------------------------------------------------

/**
 * Retourne le statut de densite pour un bac donne.
 *
 * Prend en compte la config elevage du site si disponible, sinon utilise les
 * seuils par defaut hardcodes dans SEUILS_PAR_SYSTEME.
 *
 * @param densiteKgM3  - Densite calculee en kg/m3 (null = inconnue)
 * @param typeSysteme  - Type de systeme du bac (null = BAC_BETON par defaut)
 * @param config       - Config elevage du site (nullable)
 * @returns Statut : "OK" | "ALERTE" | "CRITIQUE" | "INCONNU"
 */
export function getStatutDensite(
  densiteKgM3: number | null,
  typeSysteme: TypeSystemeBac | null,
  config?: ConfigSeuilsDensite | null
): StatutDensite {
  if (densiteKgM3 == null) return "INCONNU";

  const systeme = typeSysteme ?? TypeSystemeBac.BAC_BETON;

  let seuilAlerte: number;
  let seuilCritique: number;

  if (config) {
    switch (systeme) {
      case TypeSystemeBac.BAC_BETON:
      case TypeSystemeBac.BAC_PLASTIQUE:
        seuilAlerte = config.densiteBacBetonAlerte ?? SEUILS_PAR_SYSTEME[TypeSystemeBac.BAC_BETON].alerte;
        seuilCritique = config.densiteBacBetonCritique ?? SEUILS_PAR_SYSTEME[TypeSystemeBac.BAC_BETON].critique;
        break;
      case TypeSystemeBac.ETANG_TERRE:
        seuilAlerte = config.densiteEtangAlerte ?? SEUILS_PAR_SYSTEME[TypeSystemeBac.ETANG_TERRE].alerte;
        seuilCritique = config.densiteEtangCritique ?? SEUILS_PAR_SYSTEME[TypeSystemeBac.ETANG_TERRE].critique;
        break;
      case TypeSystemeBac.RAS:
        seuilAlerte = config.densiteRasAlerte ?? SEUILS_PAR_SYSTEME[TypeSystemeBac.RAS].alerte;
        seuilCritique = config.densiteRasCritique ?? SEUILS_PAR_SYSTEME[TypeSystemeBac.RAS].critique;
        break;
      default:
        seuilAlerte = SEUILS_PAR_SYSTEME[TypeSystemeBac.BAC_BETON].alerte;
        seuilCritique = SEUILS_PAR_SYSTEME[TypeSystemeBac.BAC_BETON].critique;
    }
  } else {
    const seuils = SEUILS_PAR_SYSTEME[systeme] ?? SEUILS_PAR_SYSTEME[TypeSystemeBac.BAC_BETON];
    seuilAlerte = seuils.alerte;
    seuilCritique = seuils.critique;
  }

  if (densiteKgM3 >= seuilCritique) return "CRITIQUE";
  if (densiteKgM3 >= seuilAlerte) return "ALERTE";
  return "OK";
}
