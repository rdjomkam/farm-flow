/**
 * Helpers purs pour les calculs basés sur le "montant livré" comme source de vérité.
 *
 * Règle métier (DV.0) :
 * - Ventes EN_PREPARATION et ANNULEE : EXCLUES de toutes les stats / dashboards / rapports.
 * - Ventes LIVREE ou CLOTUREE : incluses dans les stats.
 * - poidsLivreKg (quand renseigné) est prioritaire sur poidsTotalKg pour les calculs.
 * - LigneVente : prorata automatique quand Vente.poidsLivreKg est saisi.
 */

import type { Vente, LigneVente, Depense } from "@/types";
import { StatutVente } from "@/types";

/**
 * Retourne le poids effectif d'une vente : livré si renseigné, sinon poidsTotal (fallback historique).
 */
export function effectivePoidsVente(
  vente: Pick<Vente, "poidsLivreKg" | "poidsTotalKg">
): number {
  return vente.poidsLivreKg ?? vente.poidsTotalKg;
}

/**
 * Retourne le nombre effectif de poissons : livré si renseigné, sinon quantitePoissons.
 */
export function effectiveQuantiteVente(
  vente: Pick<Vente, "quantiteLivree" | "quantitePoissons">
): number {
  return vente.quantiteLivree ?? vente.quantitePoissons;
}

/**
 * Montant brut effectif (basé sur le livré).
 */
export function effectiveMontantBrut(
  vente: Pick<Vente, "poidsLivreKg" | "poidsTotalKg" | "prixUnitaireKg">
): number {
  return effectivePoidsVente(vente) * vente.prixUnitaireKg;
}

/**
 * True si la vente compte pour les stats (LIVREE ou CLOTUREE uniquement).
 * EN_PREPARATION et ANNULEE sont exclues.
 */
export function venteCompteDansStats(vente: Pick<Vente, "statut">): boolean {
  return (
    vente.statut === StatutVente.LIVREE ||
    vente.statut === StatutVente.CLOTUREE
  );
}

/**
 * Pour une LigneVente, retourne le poids effectif livré au prorata du poidsLivreKg global.
 * Si la vente n'a pas de poidsLivreKg, retourne le poidsTotalKg de la ligne (fallback).
 */
export function effectivePoidsLigneVente(
  ligne: Pick<LigneVente, "poidsTotalKg">,
  vente: Pick<Vente, "poidsLivreKg" | "poidsTotalKg">
): number {
  // Si pas de poidsLivreKg sur la vente → pas de prorata, on garde la ligne telle quelle
  if (vente.poidsLivreKg == null || vente.poidsTotalKg === 0) {
    return ligne.poidsTotalKg;
  }
  const ratio = vente.poidsLivreKg / vente.poidsTotalKg;
  return ligne.poidsTotalKg * ratio;
}

/**
 * Somme des depenses liees a une vente.
 */
export function totalDepensesVente(
  depenses: Pick<Depense, "montantTotal">[]
): number {
  return depenses.reduce((sum, d) => sum + d.montantTotal, 0);
}

/**
 * Retourne le montant NET d'une vente = brut effectif - depenses associees.
 * Brut effectif = effectiveMontantBrut(vente) (defini ci-dessus).
 */
export function montantNetVente(
  vente: Pick<Vente, "poidsLivreKg" | "poidsTotalKg" | "prixUnitaireKg">,
  depenses: Pick<Depense, "montantTotal">[]
): number {
  return effectiveMontantBrut(vente) - totalDepensesVente(depenses);
}

/**
 * Pour une ligne de vente, retourne le montant brut effectif (poids livre x prix).
 */
export function effectiveMontantLigneVente(
  ligne: Pick<LigneVente, "poidsTotalKg">,
  vente: Pick<Vente, "poidsLivreKg" | "poidsTotalKg" | "prixUnitaireKg">
): number {
  return effectivePoidsLigneVente(ligne, vente) * vente.prixUnitaireKg;
}

/**
 * Idem pour le nombre de poissons.
 */
export function effectiveNombrePoissonsLigne(
  ligne: Pick<LigneVente, "nombrePoissons">,
  vente: Pick<Vente, "quantiteLivree" | "quantitePoissons">
): number {
  if (vente.quantiteLivree == null || vente.quantitePoissons === 0) {
    return ligne.nombrePoissons;
  }
  const ratio = vente.quantiteLivree / vente.quantitePoissons;
  return Math.round(ligne.nombrePoissons * ratio);
}
