/**
 * Queries Prisma — Abonnement (Sprint 30)
 *
 * R2 : importer les enums depuis @/types
 * R4 : toutes les transitions de statut via updateMany avec condition (jamais check-then-update)
 * R8 : siteId obligatoire sur toutes les queries
 */
import { cache } from "react";
import { prisma } from "@/lib/db";
import { StatutAbonnement } from "@/types";
import type { AbonnementFilters, CreateAbonnementDTO } from "@/types";

/** Liste les abonnements d'un site avec filtres optionnels */
export async function getAbonnements(
  siteId: string,
  filters?: AbonnementFilters
) {
  return prisma.abonnement.findMany({
    where: {
      siteId,
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

/**
 * Récupère l'abonnement actif ou en grâce d'un site.
 * Un site n'a qu'un seul abonnement ACTIF ou EN_GRACE à la fois.
 */
export const getAbonnementActif = cache(async (siteId: string) => {
  return prisma.abonnement.findFirst({
    where: {
      siteId,
      statut: {
        in: [StatutAbonnement.ACTIF, StatutAbonnement.EN_GRACE],
      },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
});

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
      site: { select: { id: true, name: true } },
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
    select: { id: true, siteId: true, userId: true },
  });
}
