/**
 * src/lib/abonnements/check-subscription.ts
 *
 * Fonctions de vérification du statut d'abonnement.
 * Utilisées par les Server Components pour conditionner l'affichage et l'accès.
 *
 * Story 32.4 — Sprint 32
 * R2 : enums importés depuis @/types (StatutAbonnement)
 *
 * Cache : unstable_cache avec TTL 1h + revalidation par tag `subscription-{siteId}`.
 * Invalidé par les routes mutation (POST /abonnements, annuler, renouveler, webhooks, cron).
 */
import { unstable_cache } from "next/cache";
import { getAbonnementActif } from "@/lib/queries/abonnements";
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
// getSubscriptionStatus — Charge l'abonnement actif et calcule les jours restants
// ---------------------------------------------------------------------------

/**
 * Version interne non-cachée.
 * Ne pas exporter directement — utiliser getSubscriptionStatus (cachée) à la place.
 */
async function _getSubscriptionStatusUncached(
  siteId: string
): Promise<SubscriptionStatus> {
  const abonnement = await getAbonnementActif(siteId);

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

  // Calculer les jours restants
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

/**
 * Charge l'abonnement actif du site et retourne son statut.
 * Résultat mis en cache 1 heure (TTL 3600s) par siteId.
 * Invalidé par revalidateTag(`subscription-${siteId}`) depuis les routes mutation.
 *
 * @param siteId - ID du site (R8)
 * @returns SubscriptionStatus avec statut + jours restants
 */
export const getSubscriptionStatus = (
  siteId: string
): Promise<SubscriptionStatus> =>
  unstable_cache(
    () => _getSubscriptionStatusUncached(siteId),
    [`subscription-status-${siteId}`],
    {
      revalidate: 3600, // 1 heure
      tags: [`subscription-${siteId}`],
    }
  )();

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
  if (!statut) return false;
  return (
    (statut as string) === StatutAbonnement.EXPIRE ||
    (statut as string) === StatutAbonnement.ANNULE
  );
}
