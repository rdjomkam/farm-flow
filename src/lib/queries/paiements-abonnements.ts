/**
 * Queries Prisma — PaiementAbonnement (Sprint 30)
 *
 * R2 : importer les enums depuis @/types
 * R4 : opérations atomiques — confirmerPaiement via updateMany idempotent
 * Sprint 52 : siteId supprimé de createPaiementAbonnement
 */
import { prisma } from "@/lib/db";
import { StatutPaiementAbo } from "@/types";
import type { FournisseurPaiement } from "@/types";

/**
 * Crée un enregistrement de paiement en statut EN_ATTENTE.
 * Sprint 52 : siteId supprimé — le paiement est au niveau user.
 */
export async function createPaiementAbonnement(data: {
  abonnementId: string;
  montant: number;
  fournisseur: FournisseurPaiement;
  initiePar: string;
  phoneNumber?: string;
  referenceExterne?: string;
}) {
  return prisma.paiementAbonnement.create({
    data: {
      abonnementId: data.abonnementId,
      montant: data.montant,
      fournisseur: data.fournisseur,
      statut: StatutPaiementAbo.EN_ATTENTE,
      initiePar: data.initiePar,
      phoneNumber: data.phoneNumber ?? null,
      referenceExterne: data.referenceExterne ?? null,
      dateInitiation: new Date(),
    },
  });
}

/**
 * Confirme un paiement par sa référence externe — R4 : idempotent via updateMany.
 * Ne modifie que les paiements EN_ATTENTE ou INITIE (pas les déjà CONFIRME).
 * Retourne le nombre de paiements mis à jour (0 = déjà confirmé ou inexistant).
 */
export async function confirmerPaiement(referenceExterne: string) {
  return prisma.paiementAbonnement.updateMany({
    where: {
      referenceExterne,
      statut: {
        in: [StatutPaiementAbo.EN_ATTENTE, StatutPaiementAbo.INITIE],
      },
    },
    data: {
      statut: StatutPaiementAbo.CONFIRME,
      dateConfirmation: new Date(),
    },
  });
}

/** Historique des paiements d'un abonnement */
export async function getPaiementsByAbonnement(abonnementId: string) {
  return prisma.paiementAbonnement.findMany({
    where: { abonnementId },
    orderBy: { dateInitiation: "desc" },
  });
}

/**
 * Récupère un paiement par référence externe — pour les webhooks.
 * Utilisé pour vérifier l'idempotence avant de confirmer.
 */
export async function getPaiementByReference(referenceExterne: string) {
  return prisma.paiementAbonnement.findFirst({
    where: { referenceExterne },
    include: { abonnement: true },
  });
}

/** Met à jour la référence externe et le statut après initiation gateway */
export async function updatePaiementApresInitiation(
  id: string,
  referenceExterne: string,
  metadata?: Record<string, unknown>
) {
  return prisma.paiementAbonnement.update({
    where: { id },
    data: {
      referenceExterne,
      statut: StatutPaiementAbo.INITIE,
      ...(metadata !== undefined && { metadata: metadata as import("@/generated/prisma/client").Prisma.InputJsonValue }),
    },
  });
}
