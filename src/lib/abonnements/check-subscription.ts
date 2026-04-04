/**
 * src/lib/abonnements/check-subscription.ts
 *
 * Fonctions de vérification du statut d'abonnement.
 * Utilisées par les Server Components pour conditionner l'affichage et l'accès.
 *
 * Story 32.4 — Sprint 32
 * Story 46.3 — Sprint 46 : ajout getSubscriptionStatus(userId) + getSubscriptionStatusForSite(siteId)
 * R2 : enums importés depuis @/types (StatutAbonnement)
 *
 * Cache :
 *   - getSubscriptionStatus(userId)        → tag `subscription-${userId}`       TTL 1h
 *   - getSubscriptionStatusForSite(siteId) → tag `subscription-site-${siteId}`  TTL 1h
 * Invalidé par invalidateSubscriptionCaches(userId) depuis les routes mutation.
 */
import { unstable_cache } from "next/cache";
import {
  getAbonnementActif,
  getAbonnementActifPourSite,
} from "@/lib/queries/abonnements";
// Note : getAbonnementActifPourSite est déjà mis en cache côté query (tag subscription-site-${siteId}).
// getSubscriptionStatusForSite ne doit PAS ajouter un second cache — c'est un anti-pattern double cache.
import { StatutAbonnement, TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubscriptionStatus {
  /** Statut de l'abonnement actif. null si aucun abonnement (pas de plan ou plan DECOUVERTE). */
  statut: StatutAbonnement | null;
  /** Nombre de jours restants avant expiration. null si pas d'abonnement. */
  daysRemaining: number | null;
  /** Nom du plan actif. null si aucun abonnement. */
  planType: TypePlan | null;
  /** true si le site est sur le plan DECOUVERTE (gratuit — pas de restrictions). */
  isDecouverte: boolean;
}

// ---------------------------------------------------------------------------
// Helpers internes non-cachés
// ---------------------------------------------------------------------------

/**
 * Calcule un SubscriptionStatus à partir d'un abonnement Prisma (+ plan inclus).
 * Utilisé par les deux variantes cachées.
 */
function _buildSubscriptionStatus(
  abonnement: {
    statut: string;
    dateFin: Date;
    plan: { typePlan: string };
  } | null
): SubscriptionStatus {
  if (!abonnement) {
    return {
      statut: null,
      daysRemaining: null,
      planType: null,
      isDecouverte: false,
    };
  }

  const planType = abonnement.plan.typePlan as TypePlan;
  const isDecouverte = planType === TypePlan.DECOUVERTE;

  const maintenant = new Date();
  const dateFin = new Date(abonnement.dateFin);
  const diffMs = dateFin.getTime() - maintenant.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return {
    statut: abonnement.statut as StatutAbonnement,
    daysRemaining,
    planType,
    isDecouverte,
  };
}

// ---------------------------------------------------------------------------
// getSubscriptionStatus — par userId (user-level)
// ---------------------------------------------------------------------------

/**
 * Charge l'abonnement actif de l'utilisateur et retourne son statut.
 * Résultat mis en cache 1 heure (TTL 3600s) par userId.
 * Invalidé par revalidateTag(`subscription-${userId}`) via invalidateSubscriptionCaches().
 *
 * @param userId - ID de l'utilisateur propriétaire de l'abonnement
 * @returns SubscriptionStatus avec statut + jours restants
 */
export const getSubscriptionStatus = (
  userId: string
): Promise<SubscriptionStatus> =>
  unstable_cache(
    async () => {
      const abonnement = await getAbonnementActif(userId);
      return _buildSubscriptionStatus(abonnement);
    },
    [`subscription-status-${userId}`],
    {
      revalidate: 3600,
      tags: [`subscription-${userId}`],
    }
  )();

// ---------------------------------------------------------------------------
// getSubscriptionStatusForSite — wrapper siteId → ownerId → getSubscriptionStatus
// ---------------------------------------------------------------------------

/**
 * Charge l'abonnement actif du propriétaire d'un site et retourne son statut.
 * Délègue directement à getAbonnementActifPourSite (déjà mis en cache 1h côté query,
 * tag `subscription-site-${siteId}`). Pas de cache supplémentaire ici — double
 * unstable_cache avec le même tag est un anti-pattern.
 * Invalidé via revalidateTag(`subscription-site-${siteId}`) dans invalidateSubscriptionCaches().
 *
 * @param siteId - ID du site (R8)
 * @returns SubscriptionStatus avec statut + jours restants
 */
export async function getSubscriptionStatusForSite(
  siteId: string
): Promise<SubscriptionStatus> {
  const abonnement = await getAbonnementActifPourSite(siteId);
  return _buildSubscriptionStatus(abonnement);
}

// ---------------------------------------------------------------------------
// Fonctions pures de vérification de statut
// ---------------------------------------------------------------------------

/**
 * isSubscriptionValid — retourne true si l'abonnement est valide (ACTIF ou EN_GRACE).
 * R2 : compare avec StatutAbonnement.ACTIF et StatutAbonnement.EN_GRACE.
 */
export function isSubscriptionValid(statut: StatutAbonnement | null): boolean {
  if (!statut) return false;
  return (
    (statut as string) === StatutAbonnement.ACTIF ||
    (statut as string) === StatutAbonnement.EN_GRACE
  );
}

/**
 * isReadOnlyMode — retourne true si le site est en mode lecture seule (SUSPENDU).
 * En mode lecture seule : consultation autorisée, création/modification interdites.
 * R2 : compare avec StatutAbonnement.SUSPENDU.
 */
export function isReadOnlyMode(statut: StatutAbonnement | null): boolean {
  if (!statut) return false;
  return (statut as string) === StatutAbonnement.SUSPENDU;
}

/**
 * isBlocked — retourne true si le site est complètement bloqué (EXPIRE ou ANNULE).
 * Exception : plan DECOUVERTE → jamais bloqué.
 * R2 : compare avec StatutAbonnement.EXPIRE et StatutAbonnement.ANNULE.
 */
export function isBlocked(statut: StatutAbonnement | null): boolean {
  if (!statut) return true;
  return (
    (statut as string) === StatutAbonnement.EXPIRE ||
    (statut as string) === StatutAbonnement.ANNULE
  );
}
