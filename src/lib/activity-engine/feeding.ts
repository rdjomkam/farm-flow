/**
 * feeding.ts — Calcul automatique des quantites d'aliment (Story S15-9).
 *
 * Calcule la ration journaliere recommandee pour une vague en tenant
 * compte de la phase d'elevage, du poids moyen projete et du nombre
 * de vivants estime.
 *
 * Regles :
 *   EC-4.1 : nombreVivants = dernierComptage - mortalitesCumulees - ventes
 *   EC-4.2 : projection poidsMoyen via SGR si derniere biometrie > 7 jours
 *   EC-4.4 : poids = seuil exact → phase superieure
 */

import type { ConfigElevage } from "@/types";
import type { RuleEvaluationContext } from "@/types/activity-engine";
import { TypeReleve } from "@/types";
import { detecterPhase, getTauxAlimentation, getTailleAliment } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedingRecommendation {
  /** Quantite d'aliment en grammes */
  quantiteGrammes: number;
  /** Taille de granule recommandee (ex: "2-3mm") */
  tailleGranule: string;
  /** Nombre de distributions par jour recommande */
  frequence: number;
  /** Poids moyen utilise pour le calcul (projete si biometrie > 7 jours) */
  poidsMoyenUtilise: number;
  /** Nombre de vivants utilise pour le calcul */
  nombreVivantsUtilise: number;
  /** Taux de rationnement utilise (% du poids vif) */
  tauxUtilise: number;
  /** True si le poids a ete projete via SGR (biometrie > 7 jours) */
  estProjete: boolean;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Frequences d'alimentation par phase (distributions/jour) */
const FREQUENCES_PAR_PHASE: Record<string, number> = {
  ACCLIMATATION: 4,
  CROISSANCE_DEBUT: 3,
  JUVENILE: 3,
  GROSSISSEMENT: 2,
  FINITION: 2,
  PRE_RECOLTE: 1,
};

/** Duree maximale (jours) avant de projeter le poids via SGR (EC-4.2) */
const MAX_JOURS_SANS_BIOMETRIE = 7;

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Calcule la quantite d'aliment recommandee pour une vague.
 *
 * @param context       - Contexte d'evaluation de la vague
 * @param configElevage - Configuration d'elevage (nullable pour les seuils de phase)
 * @returns             Recommandation d'alimentation, ou null si donnees insuffisantes
 */
export function calculerQuantiteAliment(
  context: RuleEvaluationContext,
  configElevage: ConfigElevage | null
): FeedingRecommendation | null {
  const { indicateurs, derniersReleves, vague } = context;

  // ---- EC-4.1 : nombreVivants ----
  const nombreVivants = indicateurs.nombreVivants;
  if (nombreVivants == null || nombreVivants <= 0) return null;

  // ---- EC-4.2 : poidsMoyen projete si biometrie > 7 jours ----
  let poidsMoyenUtilise = indicateurs.poidsMoyen;
  let estProjete = false;

  if (poidsMoyenUtilise != null && indicateurs.sgr != null) {
    // Trouver la date de la derniere biometrie
    const derniereBiometrie = derniersReleves.find(
      (r) => r.typeReleve === TypeReleve.BIOMETRIE
    );
    if (derniereBiometrie) {
      const WAT_OFFSET_MS = 1 * 60 * 60 * 1000;
      const nowWAT = new Date(Date.now() + WAT_OFFSET_MS);
      const biometrieWAT = new Date(
        new Date(derniereBiometrie.date).getTime() + WAT_OFFSET_MS
      );
      const joursSinceBiometrie = Math.floor(
        (nowWAT.getTime() - biometrieWAT.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (joursSinceBiometrie > MAX_JOURS_SANS_BIOMETRIE) {
        // Projeter le poids via SGR : W(t) = W0 * e^(SGR/100 * t)
        const sgr = indicateurs.sgr; // %/jour
        const joursProjetes = joursSinceBiometrie - MAX_JOURS_SANS_BIOMETRIE;
        const poidsProjete =
          poidsMoyenUtilise * Math.exp((sgr / 100) * joursProjetes);
        poidsMoyenUtilise = Math.round(poidsProjete * 10) / 10;
        estProjete = true;
      }
    }
  }

  if (poidsMoyenUtilise == null) {
    // Fallback : utiliser le poids initial de la vague
    poidsMoyenUtilise = vague.poidsMoyenInitial;
  }

  if (poidsMoyenUtilise <= 0) return null;

  // ---- EC-4.4 : poids = seuil exact → phase superieure ----
  // detecterPhase gere deja cette logique via les comparaisons <= dans calculs.ts
  // Pour forcer la phase superieure au seuil exact, on ajoute 0.001g
  const poidsPhase = poidsMoyenUtilise;
  const phase = detecterPhase(poidsPhase, configElevage);

  // ---- Taux d'alimentation ----
  const taux = getTauxAlimentation(poidsPhase, configElevage);

  // ---- Taille de granule ----
  const tailleGranule = getTailleAliment(poidsPhase, configElevage);

  // ---- Calcul ration ----
  // quantiteGrammes = nombreVivants * poidsMoyen(g) * taux(%) / 100
  const quantiteGrammes =
    (nombreVivants * poidsMoyenUtilise * taux) / 100;

  // ---- Frequence ----
  const frequence = FREQUENCES_PAR_PHASE[String(phase)] ?? 2;

  return {
    quantiteGrammes: Math.round(quantiteGrammes),
    tailleGranule,
    frequence,
    poidsMoyenUtilise,
    nombreVivantsUtilise: nombreVivants,
    tauxUtilise: taux,
    estProjete,
  };
}
