/**
 * Libellés et fonctions de formatage — carte "Bacs en dérive" du dashboard.
 *
 * Sprint BD — Story BD.1 (ADR-051). Consommé par le composant UI de la story
 * BD.2 (`src/components/dashboard/bacs-en-derive-section.tsx`, hors périmètre
 * de ce fichier).
 *
 * Contexte : la détection d'un écart de conservation (`EcartAssignationConstate`,
 * ADR-048) est PARESSEUSE — elle ne se met à jour que lorsqu'une opération
 * guardée (arrivage, transfert, calibrage, vente, vente-alevins, bon de
 * livraison) touche le bac concerné. Il n'existe aucun balayage périodique
 * (ADR-051, section 2). Les libellés ci-dessous doivent donc TOUJOURS
 * présenter la liste comme "ce qui a été détecté", jamais comme "l'état
 * garanti de tous les bacs" — voir ADR-051 pour la justification complète et
 * les formulations rejetées.
 *
 * R1/R2 : toute valeur d'énumération est importée depuis "@/types", jamais
 * un littéral.
 */

import { ContexteDetectionEcart } from "@/types";
import { formatDate } from "@/lib/format";

// ---------------------------------------------------------------------------
// Libellés de la carte (titre, nuance, colonnes, lien)
// ---------------------------------------------------------------------------

/**
 * BACS_EN_DERIVE_LABELS — libellés statiques (fr) de la carte "Bacs en
 * dérive" du dashboard.
 *
 * `title` et `nuance` sont la formulation retenue par l'ADR-051 : le titre
 * nomme l'événement observé ("écarts détectés"), jamais un état absolu
 * ("bacs sains" / "aucune dérive"). La `nuance` rend explicite la limite de
 * détection sans transformer la carte en avertissement anxiogène — elle
 * n'apparaît que sur une carte qui, par construction (cf. ADR-051), ne
 * s'affiche que s'il y a au moins un résultat.
 */
export const BACS_EN_DERIVE_LABELS = {
  /** Titre de la carte. */
  title: "Écarts détectés sur des bacs",
  /** Phrase de nuance affichée sous le titre — explicite la limite de détection paresseuse. */
  nuance:
    "Constaté lors des dernières opérations enregistrées — un bac sans opération récente peut dériver sans apparaître ici.",
  /** Libellés de colonnes / champs de la liste. */
  colonnes: {
    bac: "Bac",
    vague: "Vague",
    ecart: "Écart",
    premiereDetection: "Détecté depuis",
  },
  /** Libellé du lien vers la fiche du bac concerné. */
  lienFicheBac: "Voir la fiche du bac",
  /** Libellé affiché si, malgré tout, l'écart vaut 0 (ne devrait pas arriver — la query filtre déjà `ecart !== 0`). */
  aucunEcart: "Aucun écart",
} as const;

/**
 * CONTEXTE_DETECTION_LABELS — libellé (fr) de l'opération métier lors de
 * laquelle la dernière détection a eu lieu (`BacEnDerive.dernierContexte`).
 * Utile pour enrichir l'affichage ("détecté lors d'un calibrage") sans
 * ajouter de jargon interne ("guard", "invariant").
 */
export const CONTEXTE_DETECTION_LABELS: Record<ContexteDetectionEcart, string> = {
  [ContexteDetectionEcart.ARRIVAGE]: "un arrivage",
  [ContexteDetectionEcart.TRANSFERT]: "un transfert",
  [ContexteDetectionEcart.CALIBRAGE]: "un calibrage",
  [ContexteDetectionEcart.VENTE]: "une vente",
  [ContexteDetectionEcart.VENTE_ALEVINS]: "une vente d'alevins",
  [ContexteDetectionEcart.BON_LIVRAISON]: "un bon de livraison",
  [ContexteDetectionEcart.INDETERMINE]: "une opération",
};

// ---------------------------------------------------------------------------
// Fonctions pures de formatage
// ---------------------------------------------------------------------------

/**
 * formatEcartSigne — Formate un écart signé (`actual - expected`) en une
 * phrase compréhensible pour un gérant, sans exposer le signe brut.
 *
 * Le signe porte un sens métier distinct :
 * - écart > 0 : il y a PLUS de poissons constatés qu'attendu ("en trop").
 * - écart < 0 : il y a MOINS de poissons constatés qu'attendu ("manquant(s)").
 *
 * @example formatEcartSigne(3)  => "3 poissons en trop"
 * @example formatEcartSigne(-1) => "1 poisson manquant"
 * @example formatEcartSigne(0)  => "Aucun écart"
 */
export function formatEcartSigne(ecart: number): string {
  if (ecart === 0) return BACS_EN_DERIVE_LABELS.aucunEcart;

  const valeurAbsolue = Math.abs(ecart);
  const unite = valeurAbsolue > 1 ? "poissons" : "poisson";

  if (ecart > 0) {
    return `${valeurAbsolue} ${unite} en trop`;
  }
  return `${valeurAbsolue} ${unite} manquant${valeurAbsolue > 1 ? "s" : ""}`;
}

/**
 * formatPremiereDetection — Formate la date de première détection d'un
 * écart (`BacEnDerive.premiereDetectionLe`) en phrase affichable.
 *
 * Volontairement une date absolue ("détecté le 12/07/2026") plutôt qu'une
 * durée relative ("depuis 3 jours") : une durée relative se périme dès que
 * l'utilisateur revient sur l'écran plus tard, une date absolue reste exacte
 * et vérifiable — cohérent avec le principe de ne jamais suggérer plus de
 * certitude que ce que la donnée garantit (ADR-051).
 *
 * @example formatPremiereDetection(new Date("2026-07-12")) => "Détecté le 12/07/2026"
 */
export function formatPremiereDetection(date: Date, locale: string = "fr"): string {
  return `Détecté le ${formatDate(date, locale)}`;
}

/**
 * formatDernierContexte — Formate le contexte de dernière détection en
 * complément de phrase ("lors d'un calibrage"), pour affichage optionnel.
 *
 * @example formatDernierContexte(ContexteDetectionEcart.CALIBRAGE) => "lors d'un calibrage"
 */
export function formatDernierContexte(contexte: ContexteDetectionEcart): string {
  return `lors de ${CONTEXTE_DETECTION_LABELS[contexte]}`;
}
