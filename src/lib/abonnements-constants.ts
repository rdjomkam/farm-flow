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
  [TypePlan.EXONERATION]: {
    [PeriodeFacturation.MENSUEL]: 0,
    [PeriodeFacturation.TRIMESTRIEL]: null,
    [PeriodeFacturation.ANNUEL]: null,
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
  [TypePlan.EXONERATION]: {
    limitesSites: 999,
    limitesBacs: 999,
    limitesVagues: 999,
    limitesIngFermes: null,
  },
};

/**
 * PLAN_LABELS — Clés i18n pour l'affichage UI des plans.
 * Usage : t(PLAN_LABELS[plan.typePlan]) avec useTranslations("abonnements")
 * R2 : utiliser TypePlan.DECOUVERTE, jamais "DECOUVERTE"
 */
export const PLAN_LABELS: Record<TypePlan, string> = {
  [TypePlan.DECOUVERTE]: "plans.DECOUVERTE",
  [TypePlan.ELEVEUR]: "plans.ELEVEUR",
  [TypePlan.PROFESSIONNEL]: "plans.PROFESSIONNEL",
  [TypePlan.ENTREPRISE]: "plans.ENTREPRISE",
  [TypePlan.INGENIEUR_STARTER]: "plans.INGENIEUR_STARTER",
  [TypePlan.INGENIEUR_PRO]: "plans.INGENIEUR_PRO",
  [TypePlan.INGENIEUR_EXPERT]: "plans.INGENIEUR_EXPERT",
  [TypePlan.EXONERATION]: "plans.EXONERATION",
};

/**
 * PERIODE_LABELS — Clés i18n des périodes de facturation.
 * Usage : t(PERIODE_LABELS[periode]) avec useTranslations("abonnements")
 */
export const PERIODE_LABELS: Record<PeriodeFacturation, string> = {
  [PeriodeFacturation.MENSUEL]: "periods.MENSUEL",
  [PeriodeFacturation.TRIMESTRIEL]: "periods.TRIMESTRIEL",
  [PeriodeFacturation.ANNUEL]: "periods.ANNUEL",
};

/**
 * STATUT_ABONNEMENT_LABELS — Clés i18n des statuts d'abonnement.
 * Usage : t(STATUT_ABONNEMENT_LABELS[statut]) avec useTranslations("abonnements")
 */
export const STATUT_ABONNEMENT_LABELS: Record<StatutAbonnement, string> = {
  [StatutAbonnement.ACTIF]: "statuts.ACTIF",
  [StatutAbonnement.EN_GRACE]: "statuts.EN_GRACE",
  [StatutAbonnement.SUSPENDU]: "statuts.SUSPENDU",
  [StatutAbonnement.EXPIRE]: "statuts.EXPIRE",
  [StatutAbonnement.ANNULE]: "statuts.ANNULE",
  [StatutAbonnement.EN_ATTENTE_PAIEMENT]: "statuts.EN_ATTENTE_PAIEMENT",
};

/**
 * FOURNISSEUR_LABELS — Clés i18n des fournisseurs de paiement.
 * Usage : t(FOURNISSEUR_LABELS[fournisseur]) avec useTranslations("abonnements")
 */
export const FOURNISSEUR_LABELS: Record<FournisseurPaiement, string> = {
  [FournisseurPaiement.SMOBILPAY]: "providers.SMOBILPAY",
  [FournisseurPaiement.MTN_MOMO]: "providers.MTN_MOMO",
  [FournisseurPaiement.ORANGE_MONEY]: "providers.ORANGE_MONEY",
  [FournisseurPaiement.MANUEL]: "providers.MANUEL",
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
