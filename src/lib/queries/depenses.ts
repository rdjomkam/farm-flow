import { prisma } from "@/lib/db";
import { StatutDepense, ModePaiement } from "@/types";
import type {
  CreateDepenseDTO,
  UpdateDepenseDTO,
  DepenseFilters,
  CreatePaiementDepenseDTO,
} from "@/types";

/** Liste les depenses d'un site avec filtres optionnels et pagination */
export async function getDepenses(
  siteId: string,
  filters?: DepenseFilters,
  pagination?: { limit: number; offset: number }
) {
  const where = {
    siteId,
    ...(filters?.categorieDepense && {
      categorieDepense: filters.categorieDepense,
    }),
    ...(filters?.statut && { statut: filters.statut }),
    ...(filters?.vagueId && { vagueId: filters.vagueId }),
    ...(filters?.commandeId && { commandeId: filters.commandeId }),
    ...(filters?.dateFrom || filters?.dateTo
      ? {
          date: {
            ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
            ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
          },
        }
      : {}),
  };

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.depense.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        commande: { select: { id: true, numero: true } },
        vague: { select: { id: true, code: true } },
        _count: { select: { paiements: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.depense.count({ where }),
  ]);

  return { data, total };
}

/** Recupere une depense par ID avec ses relations completes */
export async function getDepenseById(id: string, siteId: string) {
  return prisma.depense.findFirst({
    where: { id, siteId },
    include: {
      user: { select: { id: true, name: true } },
      commande: {
        select: {
          id: true,
          numero: true,
          statut: true,
          montantTotal: true,
          fournisseur: { select: { id: true, nom: true } },
        },
      },
      vague: { select: { id: true, code: true } },
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
 * Cree une depense.
 *
 * Regles metier :
 * 1. Numero auto-genere au format DEP-YYYY-NNN (dans une transaction)
 * 2. Si commandeId fourni, verifie que la commande appartient au site
 * 3. Statut initial : NON_PAYEE, montantPaye : 0
 */
export async function createDepense(
  siteId: string,
  userId: string,
  data: CreateDepenseDTO
) {
  return prisma.$transaction(async (tx) => {
    // Verify commande belongs to site if provided
    if (data.commandeId) {
      const commande = await tx.commande.findFirst({
        where: { id: data.commandeId, siteId },
      });
      if (!commande) throw new Error("Commande introuvable");
    }

    // Verify vague belongs to site if provided
    if (data.vagueId) {
      const vague = await tx.vague.findFirst({
        where: { id: data.vagueId, siteId },
      });
      if (!vague) throw new Error("Vague introuvable");
    }

    // Generate numero DEP-YYYY-NNN
    const year = new Date().getFullYear();
    const count = await tx.depense.count({
      where: { siteId, numero: { startsWith: `DEP-${year}` } },
    });
    const numero = `DEP-${year}-${String(count + 1).padStart(3, "0")}`;

    return tx.depense.create({
      data: {
        numero,
        description: data.description,
        categorieDepense: data.categorieDepense,
        montantTotal: data.montantTotal,
        date: new Date(data.date),
        dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
        vagueId: data.vagueId ?? null,
        commandeId: data.commandeId ?? null,
        notes: data.notes ?? null,
        userId,
        siteId,
      },
      include: {
        user: { select: { id: true, name: true } },
        commande: { select: { id: true, numero: true } },
        vague: { select: { id: true, code: true } },
      },
    });
  });
}

/**
 * Modifie une depense (mise a jour partielle).
 *
 * Seules les depenses NON_PAYEE peuvent etre modifiees en montantTotal.
 * Les autres champs (description, notes, dateEcheance) sont toujours modifiables.
 *
 * Regle metier : montantTotal ne peut pas etre inferieur au montantPaye existant.
 */
export async function updateDepense(
  id: string,
  siteId: string,
  data: UpdateDepenseDTO
) {
  return prisma.$transaction(async (tx) => {
    // Si montantTotal est fourni, verifier qu'il est >= montantPaye existant
    if (data.montantTotal !== undefined) {
      const existing = await tx.depense.findFirst({
        where: { id, siteId },
        select: { montantPaye: true },
      });
      if (!existing) throw new Error("Depense introuvable");
      if (data.montantTotal < existing.montantPaye) {
        throw new Error(
          "Le montant total ne peut pas etre inferieur au montant deja paye."
        );
      }
    }

    const result = await tx.depense.updateMany({
      where: { id, siteId },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        ...(data.categorieDepense !== undefined && {
          categorieDepense: data.categorieDepense,
        }),
        ...(data.montantTotal !== undefined && {
          montantTotal: data.montantTotal,
        }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.dateEcheance !== undefined && {
          dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
        }),
        ...(data.vagueId !== undefined && { vagueId: data.vagueId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    if (result.count === 0) {
      throw new Error("Depense introuvable");
    }

    return tx.depense.findFirst({
      where: { id, siteId },
      include: {
        user: { select: { id: true, name: true } },
        commande: { select: { id: true, numero: true } },
        vague: { select: { id: true, code: true } },
        paiements: { orderBy: { date: "desc" } },
      },
    });
  });
}

/**
 * Supprime une depense.
 *
 * Regles metier :
 * - Seulement si statut NON_PAYEE (aucun paiement ne doit exister)
 *
 * R4 : utilise deleteMany atomique avec condition sur statut.
 */
export async function deleteDepense(id: string, siteId: string) {
  // Tentative atomique : supprime uniquement si NON_PAYEE et appartient au site (R4)
  const result = await prisma.depense.deleteMany({
    where: { id, siteId, statut: StatutDepense.NON_PAYEE },
  });

  if (result.count > 0) return { success: true };

  // count === 0 : soit introuvable, soit statut non NON_PAYEE — distinguer les deux
  const existing = await prisma.depense.findFirst({
    where: { id, siteId },
    select: { id: true, statut: true },
  });

  if (!existing) throw new Error("Depense introuvable");

  throw new Error(
    "Impossible de supprimer une depense avec des paiements. Annulez les paiements d'abord."
  );
}

/**
 * Ajoute un paiement a une depense (transaction atomique).
 *
 * Regles metier (identiques au pattern Facture/Paiement) :
 * 1. La depense doit appartenir au site
 * 2. La depense ne doit pas etre PAYEE
 * 3. Le montant du paiement ne doit pas depasser le reste a payer
 * 4. Recalcule montantPaye = SUM(paiements)
 * 5. Met a jour le statut :
 *    - montantPaye >= montantTotal → PAYEE
 *    - montantPaye > 0 → PAYEE_PARTIELLEMENT
 *    - sinon → NON_PAYEE
 */
export async function ajouterPaiementDepense(
  siteId: string,
  depenseId: string,
  userId: string,
  data: CreatePaiementDepenseDTO
) {
  return prisma.$transaction(async (tx) => {
    // Get depense with current state
    const depense = await tx.depense.findFirst({
      where: { id: depenseId, siteId },
    });
    if (!depense) throw new Error("Depense introuvable");

    if (depense.statut === StatutDepense.PAYEE) {
      throw new Error("Cette depense est deja entierement payee");
    }

    // Check remaining amount
    const resteAPayer = depense.montantTotal - depense.montantPaye;
    if (data.montant > resteAPayer) {
      throw new Error(
        `Le montant depasse le reste a payer. Reste : ${resteAPayer} FCFA, saisi : ${data.montant} FCFA`
      );
    }

    // Create paiement
    const paiement = await tx.paiementDepense.create({
      data: {
        depenseId,
        montant: data.montant,
        mode: data.mode as ModePaiement,
        reference: data.reference ?? null,
        userId,
        siteId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Recalculate montantPaye from all paiements
    const aggregation = await tx.paiementDepense.aggregate({
      where: { depenseId },
      _sum: { montant: true },
    });
    const newMontantPaye = aggregation._sum.montant ?? 0;

    // Determine new statut
    const newStatut =
      newMontantPaye >= depense.montantTotal
        ? StatutDepense.PAYEE
        : newMontantPaye > 0
          ? StatutDepense.PAYEE_PARTIELLEMENT
          : StatutDepense.NON_PAYEE;

    // Update depense
    await tx.depense.update({
      where: { id: depenseId },
      data: {
        montantPaye: newMontantPaye,
        ...(newStatut !== depense.statut && { statut: newStatut }),
      },
    });

    return {
      paiement,
      statut: newStatut,
      montantPaye: newMontantPaye,
    };
  });
}
