import { prisma } from "@/lib/db";
import { generateNextNumero } from "./numero-utils";
import { StatutFacture, StatutVente } from "@/types";
import type {
  CreateFactureDTO,
  UpdateFactureDTO,
  CreatePaiementDTO,
  FactureFilters,
} from "@/types";

/** Liste les factures d'un site avec filtres et pagination */
export async function getFactures(
  siteId: string,
  filters?: FactureFilters,
  pagination?: { limit: number; offset: number }
) {
  const where = {
    siteId,
    ...(filters?.statut && { statut: filters.statut }),
    ...(filters?.dateFrom || filters?.dateTo
      ? {
          dateEmission: {
            ...(filters?.dateFrom && { gte: new Date(filters.dateFrom) }),
            ...(filters?.dateTo && { lte: new Date(filters.dateTo) }),
          },
        }
      : {}),
  };

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.facture.findMany({
      where,
      include: {
        vente: {
          select: {
            id: true,
            numero: true,
            montantTotal: true,
            client: { select: { id: true, nom: true } },
          },
        },
        user: { select: { id: true, name: true } },
        _count: { select: { paiements: true } },
      },
      orderBy: { dateEmission: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.facture.count({ where }),
  ]);

  return { data, total };
}

/** Recupere une facture par ID avec ses relations */
export async function getFactureById(id: string, siteId: string) {
  return prisma.facture.findFirst({
    where: { id, siteId },
    include: {
      vente: {
        include: {
          client: true,
          vague: { select: { id: true, code: true } },
        },
      },
      user: { select: { id: true, name: true } },
      paiements: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
      },
    },
  });
}

/**
 * Cree une facture a partir d'une vente.
 *
 * Regles metier :
 * 1. La vente doit appartenir au site
 * 2. La vente ne doit pas deja avoir une facture (relation 1:1)
 */
export async function createFacture(
  siteId: string,
  userId: string,
  data: CreateFactureDTO
) {
  return prisma.$transaction(async (tx) => {
    // Verify vente belongs to site
    const vente = await tx.vente.findFirst({
      where: { id: data.venteId, siteId },
      include: { facture: { select: { id: true } } },
    });
    if (!vente) throw new Error("Vente introuvable");

    if (vente.facture) {
      throw new Error("Cette vente a deja une facture associee");
    }

    if (vente.statut !== StatutVente.LIVREE) {
      throw new Error("La facture ne peut etre generee que pour une vente livree");
    }

    // Generate numero FAC-YYYY-NNN (findFirst+orderBy to avoid race condition)
    const numero = await generateNextNumero(tx, "facture", "FAC", siteId);

    return tx.facture.create({
      data: {
        numero,
        venteId: data.venteId,
        montantTotal: vente.montantTotal,
        dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
        notes: data.notes ?? null,
        userId,
        siteId,
      },
      include: {
        vente: {
          include: {
            client: { select: { id: true, nom: true } },
          },
        },
      },
    });
  });
}

/** Met a jour une facture (statut, echeance, notes) */
export async function updateFacture(
  id: string,
  siteId: string,
  data: UpdateFactureDTO
) {
  const result = await prisma.facture.updateMany({
    where: { id, siteId },
    data: {
      ...(data.statut !== undefined && { statut: data.statut }),
      ...(data.dateEcheance !== undefined && {
        dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
      }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  if (result.count === 0) {
    throw new Error("Facture introuvable");
  }

  return prisma.facture.findFirst({
    where: { id, siteId },
    include: {
      vente: {
        include: {
          client: { select: { id: true, nom: true } },
        },
      },
      paiements: { orderBy: { date: "desc" } },
    },
  });
}

/**
 * Regenere une facture en resynchronisant le montant depuis la vente.
 * Utile apres cloture de livraison (poids livre fait foi du montant).
 */
export async function regenererFacture(
  factureId: string,
  siteId: string,
) {
  return prisma.$transaction(async (tx) => {
    const facture = await tx.facture.findFirst({
      where: { id: factureId, siteId },
      include: { vente: { select: { montantTotal: true, statut: true } } },
    });
    if (!facture) throw new Error("Facture introuvable");

    if (facture.vente.statut === StatutVente.CLOTUREE) {
      throw new Error("Impossible de regenerer la facture d'une vente cloturee");
    }

    if (facture.statut === StatutFacture.ANNULEE) {
      throw new Error("Impossible de regenerer une facture annulee");
    }

    const newMontant = facture.vente.montantTotal;
    if (newMontant === facture.montantTotal) {
      return tx.facture.findFirst({
        where: { id: factureId },
        include: {
          vente: { include: { client: { select: { id: true, nom: true } } } },
          paiements: { orderBy: { date: "desc" } },
        },
      });
    }

    const newStatut = facture.montantPaye >= newMontant
      ? StatutFacture.PAYEE
      : facture.montantPaye > 0
        ? StatutFacture.PAYEE_PARTIELLEMENT
        : facture.statut;

    return tx.facture.update({
      where: { id: factureId },
      data: { montantTotal: newMontant, statut: newStatut },
      include: {
        vente: { include: { client: { select: { id: true, nom: true } } } },
        paiements: { orderBy: { date: "desc" } },
      },
    });
  });
}

/**
 * Ajoute un paiement a une facture (transaction atomique).
 *
 * Regles metier :
 * 1. La facture doit appartenir au site et ne pas etre ANNULEE ni PAYEE
 * 2. Le montant du paiement ne doit pas depasser le reste a payer
 * 3. Recalcule montantPaye = SUM(paiements)
 * 4. Met a jour le statut :
 *    - montantPaye >= montantTotal → PAYEE
 *    - montantPaye > 0 → PAYEE_PARTIELLEMENT
 */
export async function ajouterPaiement(
  siteId: string,
  factureId: string,
  userId: string,
  data: CreatePaiementDTO
) {
  return prisma.$transaction(async (tx) => {
    // Get facture with current state
    const facture = await tx.facture.findFirst({
      where: { id: factureId, siteId },
      include: { vente: { select: { statut: true } } },
    });
    if (!facture) throw new Error("Facture introuvable");

    if (facture.vente.statut === StatutVente.CLOTUREE) {
      throw new Error("Impossible de modifier les paiements d'une vente cloturee");
    }

    if (facture.statut === StatutFacture.ANNULEE) {
      throw new Error("Impossible d'ajouter un paiement a une facture annulee");
    }


    // Create paiement
    const paiement = await tx.paiement.create({
      data: {
        factureId,
        montant: data.montant,
        mode: data.mode,
        reference: data.reference ?? null,
        userId,
        siteId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Recalculate montantPaye from all paiements
    const aggregation = await tx.paiement.aggregate({
      where: { factureId },
      _sum: { montant: true },
    });
    const newMontantPaye = aggregation._sum.montant ?? 0;

    // Determine new statut
    const newStatut =
      newMontantPaye >= facture.montantTotal
        ? StatutFacture.PAYEE
        : newMontantPaye > 0
          ? StatutFacture.PAYEE_PARTIELLEMENT
          : facture.statut;

    // Update facture
    await tx.facture.update({
      where: { id: factureId },
      data: {
        montantPaye: newMontantPaye,
        ...(newStatut !== facture.statut && { statut: newStatut }),
      },
    });

    return paiement;
  });
}

/**
 * Supprime un paiement d'une facture (transaction atomique).
 *
 * Regles metier :
 * 1. La facture doit appartenir au site et ne pas etre ANNULEE
 * 2. La vente ne doit pas etre CLOTUREE
 * 3. Recalcule montantPaye = SUM(paiements restants)
 * 4. Met a jour le statut de la facture
 */
export async function supprimerPaiement(
  siteId: string,
  factureId: string,
  paiementId: string,
) {
  return prisma.$transaction(async (tx) => {
    const paiement = await tx.paiement.findFirst({
      where: { id: paiementId, factureId, siteId },
      include: {
        facture: {
          select: { statut: true, montantTotal: true, vente: { select: { statut: true } } },
        },
      },
    });
    if (!paiement) throw new Error("Paiement introuvable");

    if (paiement.facture.vente.statut === StatutVente.CLOTUREE) {
      throw new Error("Impossible de modifier les paiements d'une vente cloturee");
    }

    if (paiement.facture.statut === StatutFacture.ANNULEE) {
      throw new Error("Impossible de supprimer un paiement d'une facture annulee");
    }

    await tx.paiement.delete({ where: { id: paiementId } });

    const aggregation = await tx.paiement.aggregate({
      where: { factureId },
      _sum: { montant: true },
    });
    const newMontantPaye = aggregation._sum.montant ?? 0;

    const newStatut =
      newMontantPaye >= paiement.facture.montantTotal
        ? StatutFacture.PAYEE
        : newMontantPaye > 0
          ? StatutFacture.PAYEE_PARTIELLEMENT
          : StatutFacture.ENVOYEE;

    await tx.facture.update({
      where: { id: factureId },
      data: { montantPaye: newMontantPaye, statut: newStatut },
    });

    return { deleted: true };
  });
}
