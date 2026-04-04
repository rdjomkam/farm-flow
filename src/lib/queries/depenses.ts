import { prisma } from "@/lib/db";
import { StatutDepense, ModePaiement, MotifFraisSupp, TypeAjustementDepense, ActionAjustementFrais } from "@/types";
import type {
  CreateDepenseDTO,
  UpdateDepenseDTO,
  DepenseFilters,
  CreatePaiementDepenseDTO,
  AjusterDepenseDTO,
  AjusterFraisDepenseDTO,
} from "@/types";
import { categorieProduitToDepense, computeDominantCategorie } from "./besoins";

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
          fraisSupp: {
            where: { deletedAt: null },
          },
        },
        orderBy: { date: "desc" },
      },
      ajustements: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      lignes: {
        select: {
          id: true,
          designation: true,
          categorieDepense: true,
          quantite: true,
          prixUnitaire: true,
          montantTotal: true,
          produit: { select: { id: true, nom: true } },
        },
        orderBy: { createdAt: "asc" },
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
          userId,
          siteId: depense.siteId,
        })),
      });
    }

    // Re-fetch paiement to include frais created above (only active frais)
    const fullPaiement = await tx.paiementDepense.findUniqueOrThrow({
      where: { id: paiement.id },
      include: {
        fraisSupp: { where: { deletedAt: null } },
        user: { select: { id: true, name: true } },
      },
    });

    // Recalculate montantPaye from all paiements (base amount only)
    const aggregation = await tx.paiementDepense.aggregate({
      where: { depenseId },
      _sum: { montant: true },
    });
    const newMontantPaye = aggregation._sum.montant ?? 0;

    // Aggregate total frais supplementaires across all paiements for this depense (only active)
    const totalFraisAgg = await tx.fraisPaiementDepense.aggregate({
      where: { paiement: { depenseId }, deletedAt: null },
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

/**
 * Ajuste un frais supplementaire d'un paiement de depense (transaction atomique — R4).
 *
 * Regles metier :
 * 1. La depense doit appartenir au site (R8)
 * 2. Le paiement doit appartenir a la depense
 * 3. Pour SUPPRIME : le frais doit appartenir au paiement et ne pas deja etre supprime
 * 4. Pour MODIFIE : soft-delete de l'ancien frais + creation d'un nouveau
 * 5. Pour AJOUTE : creation d'un nouveau frais
 * 6. Cree un AjustementDepense de type FRAIS_SUPP (audit trail immuable — R8 : siteId)
 * 7. Recalcule Depense.montantFraisSupp = SUM(montant WHERE deletedAt IS NULL)
 */
export async function ajusterFraisDepense(
  id: string,
  siteId: string,
  userId: string,
  data: AjusterFraisDepenseDTO
) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify depense belongs to site
    const depense = await tx.depense.findFirst({
      where: { id, siteId },
    });
    if (!depense) throw new Error("Depense introuvable");

    // 2. Verify paiement belongs to the depense
    const paiement = await tx.paiementDepense.findFirst({
      where: { id: data.paiementId, depenseId: id },
    });
    if (!paiement) throw new Error("Paiement introuvable ou n'appartient pas a cette depense");

    let montantAvant = 0;
    let montantApres = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resultFrais: any = null;

    if (data.action === ActionAjustementFrais.SUPPRIME) {
      // 3. Verify frais belongs to paiement and is not already deleted
      if (!data.fraisId) throw new Error("fraisId est obligatoire pour l'action SUPPRIME");
      const frais = await tx.fraisPaiementDepense.findFirst({
        where: { id: data.fraisId, paiementId: data.paiementId, deletedAt: null },
      });
      if (!frais) throw new Error("Frais introuvable ou deja supprime");

      montantAvant = frais.montant;
      montantApres = 0;

      // Soft-delete
      await tx.fraisPaiementDepense.update({
        where: { id: data.fraisId },
        data: { deletedAt: new Date() },
      });
      resultFrais = null;

    } else if (data.action === ActionAjustementFrais.MODIFIE) {
      // 4. Soft-delete old frais + create new one
      if (!data.fraisId) throw new Error("fraisId est obligatoire pour l'action MODIFIE");
      if (!data.montant || data.montant <= 0) throw new Error("montant est obligatoire et doit etre > 0 pour MODIFIE");

      const oldFrais = await tx.fraisPaiementDepense.findFirst({
        where: { id: data.fraisId, paiementId: data.paiementId, deletedAt: null },
      });
      if (!oldFrais) throw new Error("Frais introuvable ou deja supprime");

      montantAvant = oldFrais.montant;
      montantApres = data.montant;

      // Soft-delete old record
      await tx.fraisPaiementDepense.update({
        where: { id: data.fraisId },
        data: { deletedAt: new Date() },
      });

      // Create new record with updated values
      resultFrais = await tx.fraisPaiementDepense.create({
        data: {
          paiementId: data.paiementId,
          motif: (data.motif ?? oldFrais.motif) as MotifFraisSupp,
          montant: data.montant,
          notes: data.notes !== undefined ? data.notes : oldFrais.notes,
          userId,
          siteId,
        },
      });

    } else {
      // AJOUTE
      if (!data.motif) throw new Error("motif est obligatoire pour l'action AJOUTE");
      if (!data.montant || data.montant <= 0) throw new Error("montant est obligatoire et doit etre > 0 pour AJOUTE");

      montantAvant = 0;
      montantApres = data.montant;

      resultFrais = await tx.fraisPaiementDepense.create({
        data: {
          paiementId: data.paiementId,
          motif: data.motif as MotifFraisSupp,
          montant: data.montant,
          notes: data.notes ?? null,
          userId,
          siteId,
        },
      });
    }

    // 6. Create AjustementDepense record (audit trail — R8: siteId)
    const ajustement = await tx.ajustementDepense.create({
      data: {
        depenseId: id,
        montantAvant,
        montantApres,
        raison: data.raison,
        userId,
        siteId,
        typeAjustement: TypeAjustementDepense.FRAIS_SUPP,
        paiementId: data.paiementId,
        fraisId: data.action === ActionAjustementFrais.SUPPRIME
          ? data.fraisId!  // deleted record ID (only option)
          : resultFrais?.id ?? null,  // live record ID for AJOUTE and MODIFIE
        actionFrais: data.action,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // 7. Recalculate montantFraisSupp = SUM(montant WHERE deletedAt IS NULL) across all payments
    const totalFraisAgg = await tx.fraisPaiementDepense.aggregate({
      where: { paiement: { depenseId: id }, deletedAt: null },
      _sum: { montant: true },
    });
    const newMontantFraisSupp = totalFraisAgg._sum.montant ?? 0;

    await tx.depense.update({
      where: { id },
      data: { montantFraisSupp: newMontantFraisSupp },
    });

    return {
      frais: resultFrais,
      ajustement,
      montantFraisSupp: newMontantFraisSupp,
    };
  });
}

// ---------------------------------------------------------------------------
// Backfill LigneDepense for existing Depenses (ADR-027)
// ---------------------------------------------------------------------------

/**
 * Backfill LigneDepense records for existing Depenses that were created
 * before ADR-027 (linked to ListeBesoins or Commande but have no lines).
 *
 * Idempotent: skips Depenses that already have LigneDepense records.
 * Each Depense is processed in its own transaction for isolation.
 */
export async function backfillLignesDepense(siteId?: string): Promise<{
  processed: number;
  skipped: number;
  errors: Array<{ depenseId: string; numero: string; error: string }>;
}> {
  // Find all depenses linked to besoins or commandes but with no lignes
  const depenses = await prisma.depense.findMany({
    where: {
      ...(siteId && { siteId }),
      OR: [
        { listeBesoinsId: { not: null } },
        { commandeId: { not: null } },
      ],
      lignes: { none: {} },
    },
    select: {
      id: true,
      numero: true,
      siteId: true,
      listeBesoinsId: true,
      commandeId: true,
    },
  });

  let processed = 0;
  let skipped = 0;
  const errors: Array<{ depenseId: string; numero: string; error: string }> = [];

  for (const dep of depenses) {
    try {
      await prisma.$transaction(async (tx) => {
        // Case 1: listeBesoinsId set (priority over commandeId)
        if (dep.listeBesoinsId) {
          const liste = await tx.listeBesoins.findUnique({
            where: { id: dep.listeBesoinsId },
            include: {
              lignes: {
                include: {
                  produit: { select: { id: true, categorie: true } },
                },
              },
            },
          });

          if (!liste) {
            skipped++;
            return; // orphan FK — skip
          }

          if (liste.lignes.length === 0) {
            skipped++;
            return; // no source lines
          }

          // Build LigneDepense data from LigneBesoin
          const lignesData = await Promise.all(
            liste.lignes.map(async (lb) => {
              const prixUnitaire = lb.prixReel ?? lb.prixEstime;
              const montantTotal = lb.quantite * prixUnitaire;
              const cat = categorieProduitToDepense(lb.produit?.categorie);

              // Try to find matching LigneCommande via (commandeId, produitId)
              let ligneCommandeId: string | null = null;
              if (dep.commandeId && lb.produitId) {
                const lc = await tx.ligneCommande.findFirst({
                  where: {
                    commandeId: dep.commandeId,
                    produitId: lb.produitId,
                  },
                  select: { id: true },
                });
                ligneCommandeId = lc?.id ?? null;
              }

              return {
                depenseId: dep.id,
                designation: lb.designation,
                categorieDepense: cat,
                quantite: lb.quantite,
                prixUnitaire,
                montantTotal,
                produitId: lb.produitId ?? null,
                ligneBesoinId: lb.id,
                ligneCommandeId,
                siteId: dep.siteId,
              };
            })
          );

          await tx.ligneDepense.createMany({ data: lignesData });

          // Recompute dominant category
          const categorieDepense = computeDominantCategorie(lignesData);
          await tx.depense.update({
            where: { id: dep.id },
            data: { categorieDepense },
          });

        // Case 2: commandeId set, no listeBesoinsId
        } else if (dep.commandeId) {
          const commande = await tx.commande.findUnique({
            where: { id: dep.commandeId },
            include: {
              lignes: {
                include: {
                  produit: { select: { id: true, categorie: true, nom: true } },
                },
              },
            },
          });

          if (!commande) {
            skipped++;
            return; // orphan FK — skip
          }

          if (commande.lignes.length === 0) {
            skipped++;
            return; // no source lines
          }

          const lignesData = commande.lignes.map((lc) => {
            const montantTotal = lc.quantite * lc.prixUnitaire;
            const cat = categorieProduitToDepense(lc.produit?.categorie);
            return {
              depenseId: dep.id,
              designation: lc.produit?.nom ?? `Ligne commande ${lc.id}`,
              categorieDepense: cat,
              quantite: lc.quantite,
              prixUnitaire: lc.prixUnitaire,
              montantTotal,
              produitId: lc.produitId,
              ligneBesoinId: null,
              ligneCommandeId: lc.id,
              siteId: dep.siteId,
            };
          });

          await tx.ligneDepense.createMany({ data: lignesData });

          // Recompute dominant category
          const categorieDepense = computeDominantCategorie(lignesData);
          await tx.depense.update({
            where: { id: dep.id },
            data: { categorieDepense },
          });
        }
      });

      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ depenseId: dep.id, numero: dep.numero, error: message });
    }
  }

  return { processed, skipped, errors };
}
