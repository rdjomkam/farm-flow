/**
 * lifecycle.ts — Fonctions de gestion du cycle de vie des entités Phase 3.
 *
 * Appelées depuis le CRON endpoint POST /api/activites/generer.
 *
 * Fonctions :
 *   - expirePackActivations     : ACTIVE → EXPIREE quand vague liée TERMINEE
 *   - suspendPackActivations    : ACTIVE → SUSPENDUE quand vague liée ANNULEE
 *   - archiveOldActivities      : compte les activités TERMINEE/ANNULEE > 90 jours (alias : countOldActivities)
 *
 * Règles :
 *   R2 — enums importés depuis @/types
 *   R4 — opérations atomiques avec updateMany
 *   R8 — siteId passé en paramètre
 */

import { prisma } from "@/lib/db";
import { StatutActivation, StatutVague, StatutActivite } from "@/types";

// ---------------------------------------------------------------------------
// Types résultats
// ---------------------------------------------------------------------------

export interface LifecycleResult {
  /** Nombre d'entités mises à jour */
  updated: number;
  /** Erreurs non bloquantes */
  errors: string[];
}

// ---------------------------------------------------------------------------
// PackActivation lifecycle
// ---------------------------------------------------------------------------

/**
 * expirePackActivations
 *
 * Passe en EXPIREE toutes les PackActivations ACTIVE dont au moins une vague
 * liée est TERMINEE.
 *
 * Stratégie atomique (R4) :
 *   1. Trouver les IDs d'activations ACTIVE ayant au moins une vague TERMINEE
 *   2. updateMany sur ces IDs
 *
 * @param siteId - site DKFarm vendeur (R8)
 */
export async function expirePackActivations(
  siteId: string
): Promise<LifecycleResult> {
  const errors: string[] = [];

  try {
    // Trouver les activations ACTIVE avec au moins une vague TERMINEE
    const activationsToExpire = await prisma.packActivation.findMany({
      where: {
        siteId,
        statut: StatutActivation.ACTIVE,
        vagues: {
          some: { statut: StatutVague.TERMINEE },
        },
      },
      select: { id: true },
    });

    if (activationsToExpire.length === 0) {
      return { updated: 0, errors };
    }

    const ids = activationsToExpire.map((a) => a.id);

    // Mise à jour atomique (R4)
    const result = await prisma.packActivation.updateMany({
      where: {
        id: { in: ids },
        statut: StatutActivation.ACTIVE,
      },
      data: { statut: StatutActivation.EXPIREE },
    });

    return { updated: result.count, errors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`[expirePackActivations] Site ${siteId} : ${msg}`);
    return { updated: 0, errors };
  }
}

/**
 * suspendPackActivations
 *
 * Passe en SUSPENDUE toutes les PackActivations ACTIVE dont au moins une vague
 * liée est ANNULEE.
 *
 * Stratégie atomique (R4) — identique à expirePackActivations mais pour ANNULEE.
 *
 * @param siteId - site DKFarm vendeur (R8)
 */
export async function suspendPackActivations(
  siteId: string
): Promise<LifecycleResult> {
  const errors: string[] = [];

  try {
    const activationsToSuspend = await prisma.packActivation.findMany({
      where: {
        siteId,
        statut: StatutActivation.ACTIVE,
        vagues: {
          some: { statut: StatutVague.ANNULEE },
        },
      },
      select: { id: true },
    });

    if (activationsToSuspend.length === 0) {
      return { updated: 0, errors };
    }

    const ids = activationsToSuspend.map((a) => a.id);

    const result = await prisma.packActivation.updateMany({
      where: {
        id: { in: ids },
        statut: StatutActivation.ACTIVE,
      },
      data: { statut: StatutActivation.SUSPENDUE },
    });

    return { updated: result.count, errors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`[suspendPackActivations] Site ${siteId} : ${msg}`);
    return { updated: 0, errors };
  }
}

// ---------------------------------------------------------------------------
// Activite archivage
// ---------------------------------------------------------------------------

/**
 * archiveOldActivities (alias : countOldActivities)
 *
 * Compte les activités TERMINEE ou ANNULEE datant de plus de ageDays jours.
 *
 * Note (S1) : le schéma Prisma ne possède pas de champ isArchived sur Activite.
 * Cette fonction ne modifie aucune donnée — elle retourne uniquement un comptage
 * pour le rapport CRON. Les activités anciennes sont exclues des vues
 * opérationnelles via un filtre de lecture (updatedAt <= cutoff).
 *
 * @param siteId    - site (R8)
 * @param ageDays   - âge en jours au-delà duquel une activité est considérée ancienne (défaut 90)
 */
export async function archiveOldActivities(
  siteId: string,
  ageDays = 90
): Promise<LifecycleResult> {
  const errors: string[] = [];

  try {
    const cutoff = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);

    const count = await prisma.activite.count({
      where: {
        siteId,
        statut: {
          in: [StatutActivite.TERMINEE, StatutActivite.ANNULEE],
        },
        updatedAt: { lte: cutoff },
      },
    });

    return { updated: count, errors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`[archiveOldActivities] Site ${siteId} : ${msg}`);
    return { updated: 0, errors };
  }
}

/**
 * countOldActivities — alias sémantique pour archiveOldActivities.
 *
 * Préférer ce nom quand la sémantique souhaitée est un comptage (pas un archivage réel).
 */
export const countOldActivities = archiveOldActivities;

// ---------------------------------------------------------------------------
// Fonction agrégée — runLifecycle
// ---------------------------------------------------------------------------

/**
 * runLifecycle
 *
 * Exécute toutes les opérations de lifecycle pour un site donné.
 * Appelée depuis le CRON endpoint POST /api/activites/generer.
 *
 * @param siteId - identifiant du site (R8)
 * @returns objet de statistiques pour le rapport CRON
 */
export async function runLifecycle(siteId: string): Promise<{
  expirationsPackActivation: number;
  suspensionsPackActivation: number;
  activitesArchivees: number;
  errors: string[];
}> {
  const allErrors: string[] = [];

  const expireResult = await expirePackActivations(siteId);
  allErrors.push(...expireResult.errors);

  const suspendResult = await suspendPackActivations(siteId);
  allErrors.push(...suspendResult.errors);

  const archiveResult = await archiveOldActivities(siteId);
  allErrors.push(...archiveResult.errors);

  return {
    expirationsPackActivation: expireResult.updated,
    suspensionsPackActivation: suspendResult.updated,
    activitesArchivees: archiveResult.updated,
    errors: allErrors,
  };
}
