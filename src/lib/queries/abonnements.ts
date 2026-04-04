/**
 * Queries Prisma — Abonnement (Sprint 30)
 *
 * R2 : importer les enums depuis @/types
 * R4 : toutes les transitions de statut via updateMany avec condition (jamais check-then-update)
 * R8 : siteId obligatoire sur toutes les queries
 *
 * Sprint 46 : getAbonnementActif prend userId (user-level).
 * getAbonnementActifPourSite résout site.ownerId → getAbonnementActif(ownerId).
 * getAbonnementActifParSite est l'alias de compatibilité ascendante.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { StatutAbonnement } from "@/types";
import type { AbonnementFilters, CreateAbonnementDTO } from "@/types";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// getAbonnementActif — par userId (user-level)
// ---------------------------------------------------------------------------

/**
 * Récupère l'abonnement actif ou en grâce d'un utilisateur.
 * Un utilisateur n'a qu'un seul abonnement ACTIF ou EN_GRACE à la fois.
 * ORDER BY statut ASC (ACTIF avant EN_GRACE), createdAt DESC, LIMIT 1.
 *
 * @param userId - ID de l'utilisateur propriétaire de l'abonnement
 */
export async function getAbonnementActif(userId: string) {
  return prisma.abonnement.findFirst({
    where: {
      userId,
      statut: {
        in: [StatutAbonnement.ACTIF, StatutAbonnement.EN_GRACE],
      },
    },
    include: { plan: true },
    orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
  });
}

// ---------------------------------------------------------------------------
// getAbonnementActifPourSite — résout ownerId puis délègue à getAbonnementActif
// ---------------------------------------------------------------------------

/**
 * Récupère l'abonnement actif du propriétaire d'un site.
 * Résout site.ownerId → getAbonnementActif(ownerId).
 * Résultat mis en cache 1 heure (TTL 3600s) par siteId.
 * Invalider via revalidateTag(`subscription-site-${siteId}`).
 *
 * @param siteId - ID du site (R8)
 */
export function getAbonnementActifPourSite(siteId: string) {
  return unstable_cache(
    async () => {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: { ownerId: true },
      });
      if (!site) return null;
      return getAbonnementActif(site.ownerId);
    },
    [`abonnement-actif-site-${siteId}`],
    {
      revalidate: 3600,
      tags: [`subscription-site-${siteId}`],
    }
  )();
}

/**
 * Alias de compatibilité ascendante pour les anciens appelants qui utilisaient
 * getAbonnementActif(siteId). À supprimer au Sprint 52.
 *
 * @deprecated Utiliser getAbonnementActifPourSite(siteId) à la place.
 */
export function getAbonnementActifParSite(siteId: string) {
  return getAbonnementActifPourSite(siteId);
}

// ---------------------------------------------------------------------------
// getAbonnements — liste par userId avec filtres
// ---------------------------------------------------------------------------

/** Liste les abonnements d'un utilisateur avec filtres optionnels */
export async function getAbonnements(
  userId: string,
  filters?: AbonnementFilters
) {
  return prisma.abonnement.findMany({
    where: {
      userId,
      ...(filters?.statut && { statut: filters.statut }),
      ...(filters?.planId && { planId: filters.planId }),
      ...(filters?.dateDebutAfter && {
        dateDebut: { gte: new Date(filters.dateDebutAfter) },
      }),
      ...(filters?.dateFinBefore && {
        dateFin: { lte: new Date(filters.dateFinBefore) },
      }),
    },
    include: {
      plan: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Récupère un abonnement par ID avec plan + paiements */
export async function getAbonnementById(id: string, siteId?: string) {
  return prisma.abonnement.findFirst({
    where: {
      id,
      ...(siteId && { siteId }),
    },
    include: {
      plan: true,
      paiements: {
        orderBy: { dateInitiation: "desc" },
      },
      remisesAppliquees: {
        include: { remise: true },
      },
    },
  });
}

/**
 * Crée un abonnement en statut EN_ATTENTE_PAIEMENT.
 * Le paiement doit être confirmé séparément pour activer l'abonnement.
 */
export async function createAbonnement(
  siteId: string,
  userId: string,
  data: CreateAbonnementDTO,
  dateDebut: Date,
  dateFin: Date,
  dateProchainRenouvellement: Date,
  prixPaye: number
) {
  return prisma.abonnement.create({
    data: {
      siteId,
      planId: data.planId,
      periode: data.periode,
      statut: StatutAbonnement.EN_ATTENTE_PAIEMENT,
      dateDebut,
      dateFin,
      dateProchainRenouvellement,
      prixPaye,
      userId,
    },
  });
}

/**
 * Active un abonnement suite à confirmation de paiement.
 * R4 : updateMany avec condition — atomique.
 * Accepte uniquement les statuts : EN_ATTENTE_PAIEMENT, EN_GRACE, SUSPENDU.
 */
export async function activerAbonnement(id: string) {
  return prisma.abonnement.updateMany({
    where: {
      id,
      statut: {
        in: [
          StatutAbonnement.EN_ATTENTE_PAIEMENT,
          StatutAbonnement.EN_GRACE,
          StatutAbonnement.SUSPENDU,
        ],
      },
    },
    data: {
      statut: StatutAbonnement.ACTIF,
    },
  });
}

/**
 * Suspend un abonnement après expiration de la période de grâce.
 * R4 : updateMany avec condition — atomique.
 * Accepte uniquement le statut EN_GRACE.
 */
export async function suspendreAbonnement(id: string) {
  return prisma.abonnement.updateMany({
    where: {
      id,
      statut: StatutAbonnement.EN_GRACE,
    },
    data: {
      statut: StatutAbonnement.SUSPENDU,
    },
  });
}

/**
 * Expire un abonnement après la durée de suspension maximale.
 * R4 : updateMany avec condition — atomique.
 * Accepte uniquement le statut SUSPENDU.
 */
export async function expirerAbonnement(id: string) {
  return prisma.abonnement.updateMany({
    where: {
      id,
      statut: StatutAbonnement.SUSPENDU,
    },
    data: {
      statut: StatutAbonnement.EXPIRE,
    },
  });
}

/**
 * Récupère les abonnements ACTIF dont la dateFin est avant la date fournie.
 * Utilisé par le CRON job de rappels (J-14, J-7, J-3, J-1).
 */
export async function getAbonnementsExpirantAvant(date: Date) {
  return prisma.abonnement.findMany({
    where: {
      statut: StatutAbonnement.ACTIF,
      dateFin: { lt: date },
    },
    include: {
      plan: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
}

/**
 * Récupère les abonnements EN_GRACE dont la dateFinGrace est dépassée.
 * Utilisé par le CRON job de suspension.
 */
export async function getAbonnementsEnGraceExpires() {
  return prisma.abonnement.findMany({
    where: {
      statut: StatutAbonnement.EN_GRACE,
      dateFinGrace: { lt: new Date() },
    },
    select: { id: true, userId: true },
  });
}

// ---------------------------------------------------------------------------
// logAbonnementAudit — helper d'audit (Sprint 46)
// ---------------------------------------------------------------------------

/**
 * Enregistre une entrée d'audit pour un abonnement.
 *
 * @param abonnementId - ID de l'abonnement concerné
 * @param action       - Libellé de l'action (ex: "ACTIVER", "SUSPENDRE")
 * @param userId       - ID de l'utilisateur qui effectue l'action
 * @param metadata     - Données supplémentaires (optionnel)
 */
export async function logAbonnementAudit(
  abonnementId: string,
  action: string,
  userId: string,
  metadata?: Record<string, unknown>
) {
  return prisma.abonnementAudit.create({
    data: {
      abonnementId,
      action,
      userId,
      metadata: metadata !== undefined
        ? (metadata as Prisma.InputJsonValue)
        : undefined,
    },
  });
}
