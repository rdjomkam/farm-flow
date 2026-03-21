/**
 * src/lib/abonnements/check-quotas.ts
 *
 * Gestion des quotas / limites de plan pour un site.
 *
 * Story 36.4 — Sprint 36
 * R2 : enums importés depuis @/types
 * R8 : siteId obligatoire
 *
 * Convention illimité : valeur >= 999 dans PLAN_LIMITES → null (illimité)
 */
import { prisma } from "@/lib/db";
import { StatutVague } from "@/types";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import { getAbonnementActif } from "@/lib/queries/abonnements";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuotaRessource {
  /** Nombre actuellement utilisé */
  actuel: number;
  /**
   * Limite autorisée par le plan.
   * null = illimité (plan ENTREPRISE ou limite >= 999)
   */
  limite: number | null;
}

export interface QuotasUsage {
  bacs: QuotaRessource;
  vagues: QuotaRessource;
  sites: QuotaRessource;
}

// ---------------------------------------------------------------------------
// Constante interne
// ---------------------------------------------------------------------------

/** Seuil à partir duquel une limite est considérée comme illimitée */
const ILLIMITE_SEUIL = 999;

// ---------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------

/**
 * normaliseLimite — Convertit une valeur >= 999 en null (illimité).
 * Règle métier : PLAN_LIMITES utilise 999 pour ENTREPRISE.
 */
export function normaliseLimite(valeur: number): number | null {
  return valeur >= ILLIMITE_SEUIL ? null : valeur;
}

/**
 * isQuotaAtteint — Retourne true si le quota est atteint ou dépassé.
 * - null = illimité → jamais atteint
 * - actuel >= limite → atteint
 */
export function isQuotaAtteint(ressource: QuotaRessource): boolean {
  if (ressource.limite === null) return false;
  return ressource.actuel >= ressource.limite;
}

// ---------------------------------------------------------------------------
// getQuotasUsage — Charge les limites et les usages réels
// ---------------------------------------------------------------------------

/**
 * getQuotasUsage — Récupère l'usage actuel des quotas pour un site.
 *
 * - Charge l'abonnement actif → récupère le plan → récupère PLAN_LIMITES
 * - Compte les bacs (tous), vagues EN_COURS, sites (1 toujours = ce site)
 * - Si aucun abonnement actif : applique les limites DECOUVERTE
 *
 * @param siteId - ID du site (R8)
 * @returns QuotasUsage avec actuel + limite pour chaque ressource
 */
export async function getQuotasUsage(siteId: string): Promise<QuotasUsage> {
  // Charger l'abonnement actif (avec le plan inclus)
  const abonnement = await getAbonnementActif(siteId);

  // Déterminer les limites selon le plan
  // Si pas d'abonnement → plan DECOUVERTE par défaut
  let limitesBacs: number;
  let limitesVagues: number;
  let limitesSites: number;

  if (abonnement) {
    // ERR-008 : cast (plan.typePlan as string) pour comparaison
    const typePlan = abonnement.plan.typePlan as string;

    // Chercher dans PLAN_LIMITES la clé correspondante
    // PLAN_LIMITES est indexé par TypePlan enum, dont les valeurs string
    // sont UPPERCASE (R1 garanti)
    const planLimites = (PLAN_LIMITES as Record<string, (typeof PLAN_LIMITES)[keyof typeof PLAN_LIMITES]>)[typePlan];

    if (planLimites) {
      limitesBacs = planLimites.limitesBacs;
      limitesVagues = planLimites.limitesVagues;
      limitesSites = planLimites.limitesSites;
    } else {
      // Fallback : DECOUVERTE
      limitesBacs = PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesBacs;
      limitesVagues = PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesVagues;
      limitesSites = PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesSites;
    }
  } else {
    // Pas d'abonnement actif → limites DECOUVERTE
    limitesBacs = PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesBacs;
    limitesVagues = PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesVagues;
    limitesSites = PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesSites;
  }

  // Compter les ressources actuelles en parallèle
  const [nombreBacs, nombreVagues] = await Promise.all([
    prisma.bac.count({ where: { siteId } }),
    prisma.vague.count({
      where: {
        siteId,
        statut: StatutVague.EN_COURS,
      },
    }),
  ]);

  return {
    bacs: {
      actuel: nombreBacs,
      limite: normaliseLimite(limitesBacs),
    },
    vagues: {
      actuel: nombreVagues,
      limite: normaliseLimite(limitesVagues),
    },
    sites: {
      // Un site ne gère que lui-même : actuel = 1 toujours
      actuel: 1,
      limite: normaliseLimite(limitesSites),
    },
  };
}
