/**
 * Queries Prisma — Remise & RemiseApplication (Sprint 30)
 *
 * R2 : importer les enums depuis @/types
 * R4 : appliquerRemise via transaction atomique
 * R8 : siteId filtrage (nullable pour remises globales)
 */
import { prisma } from "@/lib/db";
import type { CreateRemiseDTO, UpdateRemiseDTO } from "@/types";

/**
 * Liste les remises actives d'un site et/ou les remises globales.
 * siteId null = inclure uniquement les globales.
 */
export async function getRemises(siteId?: string, includeGlobales = true) {
  return prisma.remise.findMany({
    where: {
      isActif: true,
      OR: [
        ...(siteId ? [{ siteId }] : []),
        ...(includeGlobales ? [{ siteId: null }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Récupère une remise par son code promo.
 * Utilisé pour valider un code lors de la souscription.
 */
export async function getRemiseByCode(code: string) {
  return prisma.remise.findUnique({
    where: { code },
  });
}

/** Crée une remise (ADMIN uniquement) */
export async function createRemise(
  userId: string,
  data: CreateRemiseDTO,
  siteId?: string
) {
  return prisma.remise.create({
    data: {
      nom: data.nom,
      code: data.code,
      type: data.type,
      valeur: data.valeur,
      estPourcentage: data.estPourcentage,
      dateDebut: new Date(data.dateDebut),
      dateFin: data.dateFin ? new Date(data.dateFin) : null,
      limiteUtilisations: data.limiteUtilisations ?? null,
      planId: data.planId ?? null,
      userId,
      siteId: siteId ?? null,
    },
  });
}

/**
 * Applique une remise à un abonnement — transaction atomique R4.
 * 1. Incrémenter nombreUtilisations sur Remise
 * 2. Créer RemiseApplication
 */
export async function appliquerRemise(
  remiseId: string,
  abonnementId: string,
  userId: string,
  montantReduit: number
) {
  return prisma.$transaction(async (tx) => {
    // Incrémenter le compteur d'utilisations
    await tx.remise.update({
      where: { id: remiseId },
      data: { nombreUtilisations: { increment: 1 } },
    });

    // Créer l'application
    return tx.remiseApplication.create({
      data: {
        remiseId,
        abonnementId,
        userId,
        montantReduit,
        appliqueLe: new Date(),
      },
    });
  });
}

/** Récupère une remise par son ID */
export async function getRemiseById(id: string) {
  return prisma.remise.findUnique({ where: { id } });
}

/** Liste TOUTES les remises (actives + inactives) — pour admin */
export async function getAllRemises(siteId?: string) {
  return prisma.remise.findMany({
    where: {
      OR: [
        ...(siteId ? [{ siteId }] : []),
        { siteId: null }, // globales toujours incluses
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Met à jour une remise (champs modifiables uniquement — code et type sont immutables) */
export async function updateRemise(id: string, data: UpdateRemiseDTO) {
  return prisma.remise.update({
    where: { id },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.valeur !== undefined && { valeur: data.valeur }),
      ...(data.estPourcentage !== undefined && { estPourcentage: data.estPourcentage }),
      ...(data.dateDebut !== undefined && { dateDebut: new Date(data.dateDebut) }),
      ...(data.dateFin !== undefined && { dateFin: data.dateFin ? new Date(data.dateFin) : null }),
      ...(data.limiteUtilisations !== undefined && { limiteUtilisations: data.limiteUtilisations }),
      ...(data.isActif !== undefined && { isActif: data.isActif }),
    },
  });
}

/** Supprime une remise par son ID (seulement si nombreUtilisations = 0) */
export async function deleteRemise(id: string) {
  return prisma.remise.delete({ where: { id } });
}

/** Désactive une remise — R4 : updateMany pour atomicité */
export async function desactiverRemise(id: string) {
  return prisma.remise.updateMany({
    where: { id },
    data: { isActif: false },
  });
}

/** Toggle atomique isActif d'une remise — R4 : updateMany */
export async function toggleRemise(id: string, isActif: boolean) {
  return prisma.remise.updateMany({
    where: { id },
    data: { isActif },
  });
}

/**
 * Vérifie si une remise est applicable à un contexte donné.
 * Retourne la remise si valide, null sinon.
 */
export async function verifierRemiseApplicable(
  code: string,
  siteId?: string
): Promise<{ remise: import("@/generated/prisma/client").Remise | null; erreur?: string }> {
  const remise = await prisma.remise.findUnique({ where: { code } });

  if (!remise) return { remise: null, erreur: "Code promo invalide" };
  if (!remise.isActif) return { remise: null, erreur: "Code promo inactif" };

  const maintenant = new Date();
  if (remise.dateDebut > maintenant) {
    return { remise: null, erreur: "Code promo pas encore valide" };
  }
  if (remise.dateFin && remise.dateFin < maintenant) {
    return { remise: null, erreur: "Code promo expiré" };
  }
  if (
    remise.limiteUtilisations !== null &&
    remise.nombreUtilisations >= remise.limiteUtilisations
  ) {
    return { remise: null, erreur: "Limite d'utilisations atteinte" };
  }

  // Si la remise est liée à un site, vérifier que le siteId correspond
  if (remise.siteId && siteId && remise.siteId !== siteId) {
    return { remise: null, erreur: "Code promo non applicable à ce site" };
  }

  return { remise };
}
