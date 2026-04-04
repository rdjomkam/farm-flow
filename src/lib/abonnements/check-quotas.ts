/**
 * src/lib/abonnements/check-quotas.ts
 *
 * Gestion des quotas / limites de plan pour un site.
 *
 * Story 36.4 — Sprint 36
 * Story 46.2 — Sprint 46 : isBlocked exclusion + getQuotaSites(userId)
 * R2 : enums importés depuis @/types
 * R8 : siteId obligatoire
 *
 * Convention illimité : valeur >= 999 dans PLAN_LIMITES → null (illimité)
 */
import { prisma } from "@/lib/db";
import { StatutVague, TypePlan } from "@/types";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import {
  getAbonnementActif,
  getAbonnementActifPourSite,
} from "@/lib/queries/abonnements";

/** Type commun des abonnements retournés par getAbonnementActif / getAbonnementActifPourSite */
type AbonnementAvecPlan = Awaited<ReturnType<typeof getAbonnementActif>>;

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
/**
 * Résout les limites du plan à partir de l'abonnement actif.
 * Factorisé pour être partagé entre getQuotasUsage et getQuotasUsageWithCounts.
 */
function resolvePlanLimites(abonnement: AbonnementAvecPlan) {
  const decouverte = PLAN_LIMITES[TypePlan.DECOUVERTE];
  if (!abonnement) {
    return { limitesBacs: decouverte.limitesBacs, limitesVagues: decouverte.limitesVagues, limitesSites: decouverte.limitesSites };
  }
  const planLimites = PLAN_LIMITES[abonnement.plan.typePlan as TypePlan];
  if (planLimites) {
    return { limitesBacs: planLimites.limitesBacs, limitesVagues: planLimites.limitesVagues, limitesSites: planLimites.limitesSites };
  }
  return { limitesBacs: decouverte.limitesBacs, limitesVagues: decouverte.limitesVagues, limitesSites: decouverte.limitesSites };
}

export async function getQuotasUsage(siteId: string): Promise<QuotasUsage> {
  return getQuotasUsageWithCounts(siteId);
}

/**
 * getQuotasUsageWithCounts — Comme getQuotasUsage, mais accepte des comptages
 * pré-calculés pour éviter des requêtes DB redondantes.
 *
 * @param siteId - ID du site (R8)
 * @param precomputedCounts - Comptages optionnels déjà disponibles côté page
 */
export async function getQuotasUsageWithCounts(
  siteId: string,
  precomputedCounts?: { bacsCount?: number; vaguesCount?: number }
): Promise<QuotasUsage> {
  const abonnement = await getAbonnementActifPourSite(siteId);
  const { limitesBacs, limitesVagues, limitesSites } = resolvePlanLimites(abonnement);

  // Utiliser les comptages pré-calculés ou faire les requêtes DB
  // Les ressources bloquées (isBlocked=true) sont exclues des quotas — ADR-020
  const [nombreBacs, nombreVagues] = await Promise.all([
    precomputedCounts?.bacsCount !== undefined
      ? Promise.resolve(precomputedCounts.bacsCount)
      : prisma.bac.count({ where: { siteId, isBlocked: false } }),
    precomputedCounts?.vaguesCount !== undefined
      ? Promise.resolve(precomputedCounts.vaguesCount)
      : prisma.vague.count({ where: { siteId, statut: StatutVague.EN_COURS, isBlocked: false } }),
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
      actuel: 1,
      limite: normaliseLimite(limitesSites),
    },
  };
}

// ---------------------------------------------------------------------------
// getQuotaSites — Quota de sites pour un utilisateur (user-level)
// ---------------------------------------------------------------------------

/**
 * Retour de getQuotaSites.
 */
export interface QuotaSites {
  /** Nombre de sites non-bloqués possédés par l'utilisateur */
  used: number;
  /** Limite autorisée par le plan (null = illimité) */
  limit: number | null;
  /** Sites restants autorisés (null = illimité) */
  remaining: number | null;
}

/**
 * getQuotaSites — Récupère le quota de sites pour un utilisateur.
 *
 * - Compte les sites non-bloqués dont l'utilisateur est propriétaire (ownerId)
 * - Récupère la limite via getAbonnementActif(userId) → plan.limitesSites
 * - Fallback DECOUVERTE si aucun abonnement actif
 *
 * @param userId - ID de l'utilisateur propriétaire des sites
 * @returns QuotaSites avec used, limit, remaining
 */
export async function getQuotaSites(userId: string): Promise<QuotaSites> {
  const [abonnement, used] = await Promise.all([
    getAbonnementActif(userId),
    prisma.site.count({ where: { ownerId: userId, isBlocked: false } }),
  ]);

  const { limitesSites } = resolvePlanLimites(abonnement);
  const limit = normaliseLimite(limitesSites);
  const remaining = limit === null ? null : Math.max(0, limit - used);

  return { used, limit, remaining };
}
