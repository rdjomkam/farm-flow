import { prisma } from "@/lib/db";
import { StatutDepense, ModePaiement, MotifFraisSupp } from "@/types";
import type {
  CreateDepenseDTO,
  UpdateDepenseDTO,
  DepenseFilters,
  CreatePaiementDepenseDTO,
  AjusterDepenseDTO,
} from "@/types";

// Re-export for use in API validation
export { MotifFraisSupp };

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
      listeBesoins: { select: { id: true, numero: true, titre: true } },
      paiements: {
        include: {
          user: { select: { id: true, name: true } },
          fraisSupp: true,
        },
        orderBy: { date: "desc" },
      },
      ajustements: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
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
 * Regles metier :
 * 1. La depense doit appartenir au site
 * 2. La depense ne doit pas etre PAYEE
 * 3. Le montant du paiement doit etre > 0 (pas de plafond — frais suppl. peuvent depasser)
 * 4. Cree les FraisPaiementDepense attaches si fournis (R8: siteId sur chaque enregistrement)
 * 5. Recalcule montantPaye = SUM(paiements) et montantFraisSupp = SUM(fraisSupp)
 * 6. Met a jour le statut en fonction du montant de base uniquement :
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

    if (data.montant <= 0) {
      throw new Error("Le montant du paiement doit etre superieur a 0");
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
        fraisSupp: true,
      },
    });

    // Create frais supplementaires if provided (R8: siteId on each record)
    if (data.fraisSupp && data.fraisSupp.length > 0) {
      await tx.fraisPaiementDepense.createMany({
        data: data.fraisSupp.map((f) => ({
          paiementId: paiement.id,
          motif: f.motif as MotifFraisSupp,
          montant: f.montant,
          notes: f.notes ?? null,
          siteId: depense.siteId,
        })),
      });
    }

    // Re-fetch paiement to include frais created above
    const fullPaiement = await tx.paiementDepense.findUniqueOrThrow({
      where: { id: paiement.id },
      include: { fraisSupp: true, user: { select: { id: true, name: true } } },
    });

    // Recalculate montantPaye from all paiements (base amount only)
    const aggregation = await tx.paiementDepense.aggregate({
      where: { depenseId },
      _sum: { montant: true },
    });
    const newMontantPaye = aggregation._sum.montant ?? 0;

    // Aggregate total frais supplementaires across all paiements for this depense
    const totalFraisAgg = await tx.fraisPaiementDepense.aggregate({
      where: { paiement: { depenseId } },
      _sum: { montant: true },
    });
    const newMontantFraisSupp = totalFraisAgg._sum.montant ?? 0;

    // Determine new statut based on base paiements only (fraisSupp excluded)
    const newStatut =
      newMontantPaye >= depense.montantTotal
        ? StatutDepense.PAYEE
        : newMontantPaye > 0
          ? StatutDepense.PAYEE_PARTIELLEMENT
          : StatutDepense.NON_PAYEE;

    // Update depense with new montantPaye and montantFraisSupp
    await tx.depense.update({
      where: { id: depenseId },
      data: {
        montantPaye: newMontantPaye,
        montantFraisSupp: newMontantFraisSupp,
        ...(newStatut !== depense.statut && { statut: newStatut }),
      },
    });

    return {
      paiement: fullPaiement,
      statut: newStatut,
      montantPaye: newMontantPaye,
      montantFraisSupp: newMontantFraisSupp,
    };
  });
}

/**
 * Ajuste le montant total d'une depense (transaction atomique — R4).
 *
 * Regles metier :
 * 1. La depense doit appartenir au site
 * 2. Le nouveau montantTotal ne peut pas etre inferieur au montantPaye existant
 * 3. Cree un enregistrement AjustementDepense (audit trail immuable — R8 : siteId)
 * 4. Recalcule le statut :
 *    - montantPaye >= montantTotal → PAYEE
 *    - montantPaye > 0 → PAYEE_PARTIELLEMENT
 *    - sinon → NON_PAYEE
 * 5. Met a jour montantTotal + champs optionnels (description, dateEcheance, notes)
 */
export async function ajusterDepense(
  id: string,
  siteId: string,
  userId: string,
  data: AjusterDepenseDTO
) {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch current depense
    const depense = await tx.depense.findFirst({
      where: { id, siteId },
    });
    if (!depense) throw new Error("Dépense introuvable");

    // 3. Validate: new montantTotal >= montantPaye
    if (data.montantTotal < depense.montantPaye) {
      throw new Error(
        "Le nouveau montant ne peut pas être inférieur au montant déjà payé"
      );
    }

    // 3. Create AjustementDepense record (R8: siteId)
    const ajustement = await tx.ajustementDepense.create({
      data: {
        depenseId: id,
        montantAvant: depense.montantTotal,
        montantApres: data.montantTotal,
        raison: data.raison,
        userId,
        siteId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // 4. Recalculate statut
    let newStatut: StatutDepense;
    if (depense.montantPaye >= data.montantTotal) {
      newStatut = StatutDepense.PAYEE;
    } else if (depense.montantPaye > 0) {
      newStatut = StatutDepense.PAYEE_PARTIELLEMENT;
    } else {
      newStatut = StatutDepense.NON_PAYEE;
    }

    // 5. Update depense
    const updatedDepense = await tx.depense.update({
      where: { id, siteId },
      data: {
        montantTotal: data.montantTotal,
        statut: newStatut,
        ...(data.description !== undefined && { description: data.description }),
        ...(data.dateEcheance !== undefined && {
          dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    return { depense: updatedDepense, ajustement };
  });
}
