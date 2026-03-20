/**
 * Queries Prisma — CommissionIngenieur & PortefeuilleIngenieur (Sprint 30)
 *
 * R2 : importer les enums depuis @/types
 * R4 : transitions atomiques via updateMany + transactions pour le portefeuille
 * R8 : siteId obligatoire sur toutes les queries
 */
import { prisma } from "@/lib/db";
import { StatutCommissionIng, StatutPaiementAbo } from "@/types";
import type { CreateCommissionDTO, DemandeRetraitDTO } from "@/types";

/** Liste les commissions d'un ingénieur avec filtres optionnels */
export async function getCommissionsIngenieur(
  ingenieurId: string,
  filters?: {
    statut?: StatutCommissionIng;
    periodeDebutAfter?: Date;
    periodeFinBefore?: Date;
  }
) {
  return prisma.commissionIngenieur.findMany({
    where: {
      ingenieurId,
      ...(filters?.statut && { statut: filters.statut }),
      ...(filters?.periodeDebutAfter && {
        periodeDebut: { gte: filters.periodeDebutAfter },
      }),
      ...(filters?.periodeFinBefore && {
        periodeFin: { lte: filters.periodeFinBefore },
      }),
    },
    include: {
      abonnement: { include: { plan: true } },
      siteClient: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Crée une commission en statut EN_ATTENTE */
export async function createCommission(
  data: CreateCommissionDTO & {
    paiementAbonnementId: string;
    montant: number;
    periodeDebut: Date;
    periodeFin: Date;
    siteId: string;
  }
) {
  return prisma.commissionIngenieur.create({
    data: {
      ingenieurId: data.ingenieurId,
      siteClientId: data.siteClientId,
      abonnementId: data.abonnementId,
      paiementAbonnementId: data.paiementAbonnementId,
      montant: data.montant,
      taux: data.taux,
      statut: StatutCommissionIng.EN_ATTENTE,
      periodeDebut: data.periodeDebut,
      periodeFin: data.periodeFin,
      siteId: data.siteId,
    },
  });
}

/**
 * Rend disponibles les commissions EN_ATTENTE créées avant une date donnée.
 * R4 : updateMany atomique — pas de check-then-update.
 * Utilisé par le CRON job mensuel (J+30 après création).
 */
export async function rendreCommissionsDisponibles(dateAvant: Date) {
  return prisma.commissionIngenieur.updateMany({
    where: {
      statut: StatutCommissionIng.EN_ATTENTE,
      createdAt: { lt: dateAvant },
    },
    data: {
      statut: StatutCommissionIng.DISPONIBLE,
    },
  });
}

/** Récupère le portefeuille d'un ingénieur avec retraits récents */
export async function getPortefeuille(ingenieurId: string) {
  const [portefeuille, commissionsRecentes] = await prisma.$transaction([
    prisma.portefeuilleIngenieur.findUnique({
      where: { ingenieurId },
      include: {
        retraits: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    }),
    prisma.commissionIngenieur.findMany({
      where: {
        ingenieurId,
        statut: {
          in: [StatutCommissionIng.DISPONIBLE, StatutCommissionIng.EN_ATTENTE],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return { portefeuille, commissionsRecentes };
}

/**
 * Demande un retrait du portefeuille — transaction atomique R4.
 * 1. Vérifier que solde >= montant
 * 2. Décrémenter le solde
 * 3. Créer RetraitPortefeuille EN_ATTENTE
 */
export async function demanderRetrait(
  ingenieurId: string,
  data: DemandeRetraitDTO,
  siteId: string
) {
  return prisma.$transaction(async (tx) => {
    // Vérifier le solde disponible
    const portefeuille = await tx.portefeuilleIngenieur.findUnique({
      where: { ingenieurId },
    });

    if (!portefeuille) {
      throw new Error("Portefeuille introuvable");
    }

    const solde = Number(portefeuille.solde);
    if (solde < data.montant) {
      throw new Error(
        `Solde insuffisant : ${solde} FCFA disponibles, ${data.montant} FCFA demandés`
      );
    }

    // Décrémenter le solde — R4 : updateMany avec condition
    const updated = await tx.portefeuilleIngenieur.updateMany({
      where: {
        ingenieurId,
        solde: { gte: data.montant },
      },
      data: {
        solde: { decrement: data.montant },
        totalPaye: { increment: data.montant },
      },
    });

    if (updated.count === 0) {
      throw new Error("Solde insuffisant ou conditions non remplies");
    }

    // Créer la demande de retrait
    return tx.retraitPortefeuille.create({
      data: {
        portefeuilleId: portefeuille.id,
        montant: data.montant,
        fournisseur: data.fournisseur,
        phoneNumber: data.phoneNumber,
        statut: StatutPaiementAbo.EN_ATTENTE,
        demandeLeBy: ingenieurId,
        siteId,
      },
    });
  });
}

/**
 * Traite un retrait (admin) — met à jour statut et référence de virement.
 * R4 : updateMany avec condition sur le statut EN_ATTENTE.
 */
export async function traiterRetrait(
  retraitId: string,
  adminId: string,
  referenceExterne: string,
  statut: typeof StatutPaiementAbo.CONFIRME | typeof StatutPaiementAbo.ECHEC
) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.retraitPortefeuille.updateMany({
      where: {
        id: retraitId,
        statut: StatutPaiementAbo.EN_ATTENTE,
      },
      data: {
        statut,
        referenceExterne,
        traitePar: adminId,
        dateTraitement: new Date(),
      },
    });

    // Si le retrait a échoué, rembourser le solde
    if (statut === StatutPaiementAbo.ECHEC && result.count > 0) {
      const retrait = await tx.retraitPortefeuille.findUnique({
        where: { id: retraitId },
      });
      if (retrait) {
        await tx.portefeuilleIngenieur.update({
          where: { id: retrait.portefeuilleId },
          data: {
            solde: { increment: Number(retrait.montant) },
            totalPaye: { decrement: Number(retrait.montant) },
          },
        });
      }
    }

    return result;
  });
}
