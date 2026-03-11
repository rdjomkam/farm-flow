import { prisma } from "@/lib/db";
import { StatutAlerte, TypeAlerte } from "@/generated/prisma/enums";
import type { CreateConfigAlerteDTO, UpdateConfigAlerteDTO } from "@/types";

// ---------------------------------------------------------------------------
// ConfigAlerte — CRUD
// ---------------------------------------------------------------------------

/**
 * Liste toutes les configurations d'alerte d'un utilisateur pour un site.
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur proprietaire des configs
 */
export async function getConfigAlertes(siteId: string, userId: string) {
  return prisma.configAlerte.findMany({
    where: { siteId, userId },
    orderBy: { typeAlerte: "asc" },
  });
}

/**
 * Cree ou met a jour (upsert) une configuration d'alerte.
 * La contrainte unique est (userId, siteId, typeAlerte) — une config par type.
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur
 * @param data   - Donnees de la config
 */
export async function createConfigAlerte(
  siteId: string,
  userId: string,
  data: CreateConfigAlerteDTO
) {
  return prisma.configAlerte.upsert({
    where: {
      userId_siteId_typeAlerte: {
        userId,
        siteId,
        typeAlerte: data.typeAlerte,
      },
    },
    update: {
      seuilValeur: data.seuilValeur ?? null,
      seuilPourcentage: data.seuilPourcentage ?? null,
      enabled: data.enabled ?? true,
    },
    create: {
      typeAlerte: data.typeAlerte,
      seuilValeur: data.seuilValeur ?? null,
      seuilPourcentage: data.seuilPourcentage ?? null,
      enabled: data.enabled ?? true,
      userId,
      siteId,
    },
  });
}

/**
 * Met a jour une configuration d'alerte existante.
 * Verifie que la config appartient bien au site (securite R8).
 *
 * @param siteId - ID du site (R8)
 * @param id     - ID de la config
 * @param data   - Champs a mettre a jour
 */
export async function updateConfigAlerte(
  siteId: string,
  id: string,
  data: UpdateConfigAlerteDTO
) {
  const result = await prisma.configAlerte.updateMany({
    where: { id, siteId },
    data: {
      ...(data.seuilValeur !== undefined && { seuilValeur: data.seuilValeur }),
      ...(data.seuilPourcentage !== undefined && {
        seuilPourcentage: data.seuilPourcentage,
      }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });

  if (result.count === 0) {
    throw new Error("Configuration d'alerte introuvable");
  }

  return prisma.configAlerte.findFirst({ where: { id, siteId } });
}

/**
 * Supprime une configuration d'alerte.
 * Verifie que la config appartient bien au site (securite R8).
 *
 * @param siteId - ID du site (R8)
 * @param id     - ID de la config
 */
export async function deleteConfigAlerte(
  siteId: string,
  id: string
): Promise<void> {
  const result = await prisma.configAlerte.deleteMany({
    where: { id, siteId },
  });

  if (result.count === 0) {
    throw new Error("Configuration d'alerte introuvable");
  }
}

// ---------------------------------------------------------------------------
// Notification — Queries
// ---------------------------------------------------------------------------

/**
 * Liste les notifications d'un utilisateur pour un site.
 * Triees par date de creation decroissante (plus recentes en premier).
 *
 * @param siteId  - ID du site (R8)
 * @param userId  - ID de l'utilisateur destinataire
 * @param filters - Filtre optionnel sur le statut (ACTIVE, LUE, TRAITEE)
 */
export async function getNotifications(
  siteId: string,
  userId: string,
  filters?: { statut?: StatutAlerte }
) {
  return prisma.notification.findMany({
    where: {
      siteId,
      userId,
      ...(filters?.statut && { statut: filters.statut }),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Recupere une notification par ID (verifie l'appartenance au site).
 *
 * @param siteId - ID du site (R8)
 * @param id     - ID de la notification
 */
export async function getNotificationById(
  siteId: string,
  id: string
) {
  return prisma.notification.findFirst({
    where: { id, siteId },
  });
}

/**
 * Met a jour le statut d'une notification (LUE ou TRAITEE).
 * Verifie l'appartenance au site.
 *
 * @param siteId - ID du site (R8)
 * @param id     - ID de la notification
 * @param statut - Nouveau statut (ACTIVE | LUE | TRAITEE)
 */
export async function updateNotificationStatut(
  siteId: string,
  id: string,
  statut: StatutAlerte
) {
  const result = await prisma.notification.updateMany({
    where: { id, siteId },
    data: { statut },
  });

  if (result.count === 0) {
    throw new Error("Notification introuvable");
  }

  const updated = await prisma.notification.findFirst({
    where: { id, siteId },
  });

  if (!updated) {
    throw new Error("Notification introuvable apres mise a jour");
  }

  return updated;
}

/**
 * Compte les notifications non lues (statut ACTIVE) pour un utilisateur.
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur
 */
export async function getUnreadNotificationCount(
  siteId: string,
  userId: string
): Promise<number> {
  return prisma.notification.count({
    where: {
      siteId,
      userId,
      statut: StatutAlerte.ACTIVE,
    },
  });
}

/**
 * Marque toutes les notifications ACTIVE d'un utilisateur comme LUE.
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur
 */
export async function markAllNotificationsRead(
  siteId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      siteId,
      userId,
      statut: StatutAlerte.ACTIVE,
    },
    data: { statut: StatutAlerte.LUE },
  });
}
