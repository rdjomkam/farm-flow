/**
 * src/lib/abonnements/prorata.ts
 *
 * Fonctions pures de calcul du prorata pour upgrade/downgrade de plan.
 *
 * Story 50.3 — Sprint 50
 * R2 : enums importés depuis @/types
 *
 * Toutes les fonctions sont pures (pas d'effets de bord, pas d'import Prisma).
 * Testables unitairement sans mock.
 */

import { PeriodeFacturation, TypePlan } from "@/types";
import { PLAN_TARIFS } from "@/lib/abonnements-constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Résultat du calcul du delta d'upgrade.
 * montantAPayer = 0 si le crédit couvre entièrement le nouveau plan.
 * creditRestant = solde crédit après l'upgrade.
 */
export interface DeltaUpgrade {
  /** Montant à payer par l'utilisateur (>= 0) */
  montantAPayer: number;
  /** Crédit restant après l'upgrade (>= 0) */
  creditRestant: number;
  /** Crédit prorata de l'abonnement actuel utilisé */
  creditProrata: number;
  /** Prix total du nouveau plan */
  prixNouveauPlan: number;
}

// ---------------------------------------------------------------------------
// calculerCreditRestant
// ---------------------------------------------------------------------------

/**
 * Calcule le crédit prorata restant sur un abonnement en cours.
 *
 * Formule : prixPaye * (joursRestants / joursTotaux)
 *
 * Guard div/0 : si joursTotaux = 0 (upgrade le jour de souscription ou
 * dates identiques), retourne prixPaye intégralement.
 *
 * Guard prixPaye = 0 : retourne 0 (plan gratuit, aucun crédit).
 *
 * @param prixPaye    - Prix payé pour l'abonnement actuel (en FCFA)
 * @param dateDebut   - Date de début de l'abonnement actuel
 * @param dateFin     - Date de fin prévue de l'abonnement actuel
 * @param aujourdhui  - Date courante (injectable pour les tests)
 * @returns Crédit prorata en FCFA (arrondi à l'entier inférieur, >= 0)
 */
export function calculerCreditRestant(
  prixPaye: number,
  dateDebut: Date,
  dateFin: Date,
  aujourdhui: Date
): number {
  // Guard : plan gratuit
  if (prixPaye <= 0) return 0;

  const msParJour = 1000 * 60 * 60 * 24;

  // Nombre total de jours de l'abonnement
  const joursTotaux = Math.round(
    (dateFin.getTime() - dateDebut.getTime()) / msParJour
  );

  // Guard div/0 : même jour ou dates inversées
  if (joursTotaux <= 0) return prixPaye;

  // Jours restants (minimum 0, ne pas aller en négatif)
  const joursRestants = Math.max(
    0,
    Math.round((dateFin.getTime() - aujourdhui.getTime()) / msParJour)
  );

  // Prorata arrondi à l'entier inférieur
  const credit = Math.floor((prixPaye * joursRestants) / joursTotaux);

  return Math.max(0, credit);
}

// ---------------------------------------------------------------------------
// calculerPrixPlan
// ---------------------------------------------------------------------------

/**
 * Calcule le prix d'un plan pour une période donnée.
 *
 * @param typePlan  - Type de plan cible (R2 : TypePlan.ELEVEUR)
 * @param periode   - Période de facturation cible
 * @returns Prix en FCFA (0 si gratuit, null si période non disponible)
 */
export function calculerPrixPlan(
  typePlan: TypePlan,
  periode: PeriodeFacturation
): number | null {
  // R2/ERR-031 : accès via TypePlan enum comme clé, jamais as keyof typeof
  const tarifsType = PLAN_TARIFS[typePlan];
  if (!tarifsType) return null;
  const prix = tarifsType[periode];
  // undefined = période non disponible pour ce plan
  if (prix === undefined) return null;
  // null signifie "non disponible" dans PLAN_TARIFS
  return prix;
}

// ---------------------------------------------------------------------------
// calculerDeltaUpgrade
// ---------------------------------------------------------------------------

/**
 * Calcule le montant à payer et le crédit restant pour un upgrade.
 *
 * Logique :
 * - Si creditProrata >= prixNouveauPlan :
 *   montantAPayer = 0, creditRestant = creditProrata - prixNouveauPlan
 * - Sinon :
 *   montantAPayer = prixNouveauPlan - creditProrata, creditRestant = 0
 *
 * @param creditProrata    - Crédit prorata de l'abonnement actuel (depuis calculerCreditRestant)
 * @param prixNouveauPlan  - Prix du nouveau plan (depuis calculerPrixPlan)
 * @param soldeCreditActuel - Solde crédit existant de l'utilisateur (optionnel, default 0)
 * @returns DeltaUpgrade avec montantAPayer et creditRestant
 */
export function calculerDeltaUpgrade(
  creditProrata: number,
  prixNouveauPlan: number,
  soldeCreditActuel: number = 0
): DeltaUpgrade {
  // Crédit total disponible = prorata + solde existant
  const creditTotal = Math.max(0, creditProrata) + Math.max(0, soldeCreditActuel);

  if (creditTotal >= prixNouveauPlan) {
    // Le crédit couvre entièrement le nouveau plan
    return {
      montantAPayer: 0,
      creditRestant: Math.max(0, creditTotal - prixNouveauPlan),
      creditProrata,
      prixNouveauPlan,
    };
  }

  // Le crédit ne couvre pas entièrement — paiement nécessaire
  return {
    montantAPayer: Math.max(0, prixNouveauPlan - creditTotal),
    creditRestant: 0,
    creditProrata,
    prixNouveauPlan,
  };
}
