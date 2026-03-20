/**
 * Constantes et fonctions pures du système d'abonnements.
 *
 * R2 : toujours utiliser les enums importés, jamais les valeurs string directement.
 * R1 : valeurs d'enum en MAJUSCULES.
 */

import {
  FournisseurPaiement,
  PeriodeFacturation,
  Remise,
  StatutAbonnement,
  TypePlan,
} from "@/types";

// ---------------------------------------------------------------------------
// Constantes tarifaires
// ---------------------------------------------------------------------------

/**
 * PLAN_TARIFS — Prix par TypePlan et PeriodeFacturation (en FCFA).
 * null = période non disponible pour ce plan.
 * 0 = gratuit.
 */
export const PLAN_TARIFS: Record<
  TypePlan,
  Partial<Record<PeriodeFacturation, number | null>>
> = {
  [TypePlan.DECOUVERTE]: {
    [PeriodeFacturation.MENSUEL]: 0,
    [PeriodeFacturation.TRIMESTRIEL]: null,
    [PeriodeFacturation.ANNUEL]: null,
  },
  [TypePlan.ELEVEUR]: {
    [PeriodeFacturation.MENSUEL]: 3000,
    [PeriodeFacturation.TRIMESTRIEL]: 7500,
    [PeriodeFacturation.ANNUEL]: 25000,
  },
  [TypePlan.PROFESSIONNEL]: {
    [PeriodeFacturation.MENSUEL]: 8000,
    [PeriodeFacturation.TRIMESTRIEL]: 20000,
    [PeriodeFacturation.ANNUEL]: 70000,
  },
  [TypePlan.ENTREPRISE]: {
    [PeriodeFacturation.MENSUEL]: 25000,
    [PeriodeFacturation.TRIMESTRIEL]: null,
    [PeriodeFacturation.ANNUEL]: null,
  },
  [TypePlan.INGENIEUR_STARTER]: {
    [PeriodeFacturation.MENSUEL]: 5000,
    [PeriodeFacturation.TRIMESTRIEL]: null,
    [PeriodeFacturation.ANNUEL]: 45000,
  },
  [TypePlan.INGENIEUR_PRO]: {
    [PeriodeFacturation.MENSUEL]: 15000,
    [PeriodeFacturation.TRIMESTRIEL]: null,
    [PeriodeFacturation.ANNUEL]: 135000,
  },
  [TypePlan.INGENIEUR_EXPERT]: {
    [PeriodeFacturation.MENSUEL]: 30000,
    [PeriodeFacturation.TRIMESTRIEL]: null,
    [PeriodeFacturation.ANNUEL]: 270000,
  },
};

/**
 * PLAN_LIMITES — Limites de ressources par TypePlan.
 * null = illimité.
 */
export const PLAN_LIMITES: Record<
  TypePlan,
  {
    limitesSites: number;
    limitesBacs: number;
    limitesVagues: number;
    limitesIngFermes: number | null;
  }
> = {
  [TypePlan.DECOUVERTE]: {
    limitesSites: 1,
    limitesBacs: 3,
    limitesVagues: 1,
    limitesIngFermes: null,
  },
  [TypePlan.ELEVEUR]: {
    limitesSites: 1,
    limitesBacs: 10,
    limitesVagues: 3,
    limitesIngFermes: null,
  },
  [TypePlan.PROFESSIONNEL]: {
    limitesSites: 3,
    limitesBacs: 30,
    limitesVagues: 10,
    limitesIngFermes: null,
  },
  [TypePlan.ENTREPRISE]: {
    limitesSites: 999,
    limitesBacs: 999,
    limitesVagues: 999,
    limitesIngFermes: null,
  },
  [TypePlan.INGENIEUR_STARTER]: {
    limitesSites: 1,
    limitesBacs: 3,
    limitesVagues: 1,
    limitesIngFermes: 5,
  },
  [TypePlan.INGENIEUR_PRO]: {
    limitesSites: 1,
    limitesBacs: 3,
    limitesVagues: 1,
    limitesIngFermes: 20,
  },
  [TypePlan.INGENIEUR_EXPERT]: {
    limitesSites: 1,
    limitesBacs: 3,
    limitesVagues: 1,
    limitesIngFermes: null,
  },
};

/**
 * PLAN_LABELS — Labels français pour l'affichage UI.
 * R2 : utiliser TypePlan.DECOUVERTE, jamais "DECOUVERTE"
 */
export const PLAN_LABELS: Record<TypePlan, string> = {
  [TypePlan.DECOUVERTE]: "Découverte",
  [TypePlan.ELEVEUR]: "Éleveur",
  [TypePlan.PROFESSIONNEL]: "Professionnel",
  [TypePlan.ENTREPRISE]: "Entreprise",
  [TypePlan.INGENIEUR_STARTER]: "Ingénieur Starter",
  [TypePlan.INGENIEUR_PRO]: "Ingénieur Pro",
  [TypePlan.INGENIEUR_EXPERT]: "Ingénieur Expert",
};

/**
 * PERIODE_LABELS — Labels français des périodes de facturation.
 */
export const PERIODE_LABELS: Record<PeriodeFacturation, string> = {
  [PeriodeFacturation.MENSUEL]: "Mensuel",
  [PeriodeFacturation.TRIMESTRIEL]: "Trimestriel",
  [PeriodeFacturation.ANNUEL]: "Annuel",
};

/**
 * STATUT_ABONNEMENT_LABELS — Labels français des statuts d'abonnement.
 */
export const STATUT_ABONNEMENT_LABELS: Record<StatutAbonnement, string> = {
  [StatutAbonnement.ACTIF]: "Actif",
  [StatutAbonnement.EN_GRACE]: "Période de grâce",
  [StatutAbonnement.SUSPENDU]: "Suspendu",
  [StatutAbonnement.EXPIRE]: "Expiré",
  [StatutAbonnement.ANNULE]: "Annulé",
  [StatutAbonnement.EN_ATTENTE_PAIEMENT]: "En attente de paiement",
};

/**
 * FOURNISSEUR_LABELS — Labels français des fournisseurs de paiement.
 */
export const FOURNISSEUR_LABELS: Record<FournisseurPaiement, string> = {
  [FournisseurPaiement.SMOBILPAY]: "Smobilpay / Maviance",
  [FournisseurPaiement.MTN_MOMO]: "MTN Mobile Money",
  [FournisseurPaiement.ORANGE_MONEY]: "Orange Money",
  [FournisseurPaiement.MANUEL]: "Paiement manuel",
};

// ---------------------------------------------------------------------------
// Constantes métier
// ---------------------------------------------------------------------------

/** Durée de la période de grâce en jours après l'expiration */
export const GRACE_PERIOD_JOURS = 7;

/** Durée de suspension en jours après la fin de la période de grâce */
export const SUSPENSION_JOURS = 30;

/** Taux de commission par défaut (10%) */
export const COMMISSION_TAUX_DEFAULT = 0.10;

/** Taux de commission premium (20%) — si l'ingénieur a formé le client */
export const COMMISSION_TAUX_PREMIUM = 0.20;

/** Montant minimum pour demander un retrait de portefeuille (FCFA) */
export const RETRAIT_MINIMUM_FCFA = 5000;

// ---------------------------------------------------------------------------
// Fonctions pures testables
// ---------------------------------------------------------------------------

/**
 * calculerMontantRemise — Calcule le montant après application d'une remise.
 *
 * Règles :
 * - Si remise fixe : prix - valeur (minimum 0)
 * - Si remise pourcentage : prix - (prix * valeur / 100) (minimum 0)
 *
 * @param prix - Prix de base en FCFA
 * @param remise - Objet Remise à appliquer
 * @returns Montant après remise (toujours >= 0)
 */
export function calculerMontantRemise(prix: number, remise: Remise): number {
  if (remise.estPourcentage) {
    const reduction = (prix * remise.valeur) / 100;
    return Math.max(0, prix - reduction);
  }
  return Math.max(0, prix - remise.valeur);
}

/**
 * calculerProchaineDate — Calcule la date de la prochaine période de facturation.
 *
 * @param base - Date de référence (début de la période actuelle)
 * @param periode - Période de facturation (MENSUEL, TRIMESTRIEL, ANNUEL)
 * @returns Date de la prochaine période
 */
export function calculerProchaineDate(
  base: Date,
  periode: PeriodeFacturation
): Date {
  const date = new Date(base);
  switch (periode) {
    case PeriodeFacturation.MENSUEL:
      date.setMonth(date.getMonth() + 1);
      break;
    case PeriodeFacturation.TRIMESTRIEL:
      date.setMonth(date.getMonth() + 3);
      break;
    case PeriodeFacturation.ANNUEL:
      date.setMonth(date.getMonth() + 12);
      break;
  }
  return date;
}
