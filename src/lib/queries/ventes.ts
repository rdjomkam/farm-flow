import { prisma } from "@/lib/db";
import { generateNextNumero } from "./numero-utils";
import { StatutVague, StatutVente, TypeReleve, CauseMortalite } from "@/types";
import { computeVivantsByBac } from "@/lib/calculs";
import type { CreateVenteDTO, UpdateVenteDTO, ClotureVenteDTO, VenteFilters } from "@/types";

/** Liste les ventes d'un site avec filtres et pagination */
export async function getVentes(
  siteId: string,
  filters?: VenteFilters,
  pagination?: { limit: number; offset: number }
) {
  const where = {
    siteId,
    ...(filters?.clientId && { clientId: filters.clientId }),
    ...(filters?.vagueId && { vagueId: filters.vagueId }),
    ...(filters?.dateFrom || filters?.dateTo
      ? {
          createdAt: {
            ...(filters?.dateFrom && { gte: new Date(filters.dateFrom) }),
            ...(filters?.dateTo && { lte: new Date(filters.dateTo) }),
          },
        }
      : {}),
  };

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.vente.findMany({
      where,
      include: {
        client: { select: { id: true, nom: true } },
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        facture: { select: { id: true, numero: true, statut: true, montantPaye: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.vente.count({ where }),
  ]);

  return { data, total };
}

/** Recupere une vente par ID avec ses relations */
export async function getVenteById(id: string, siteId: string) {
  return prisma.vente.findFirst({
    where: { id, siteId },
    include: {
      client: true,
      vague: { select: { id: true, code: true, statut: true } },
      user: { select: { id: true, name: true } },
      facture: {
        include: {
          paiements: { orderBy: { date: "desc" } },
        },
      },
    },
  });
}

/**
 * Cree une vente avec deduction des poissons (transaction atomique).
 *
 * Regles metier :
 * 1. Le client doit appartenir au site et etre actif
 * 2. La vague doit appartenir au site
 * 3. Le nombre de poissons est calcule cote serveur :
 *    `quantitePoissons = round(poidsTotalKg * 1000 / poidsMoyenG)`
 *    `poidsMoyenG` provient du DTO (override manuel) sinon de la derniere
 *    BIOMETRIE de la vague. Erreur 400 si aucune des deux sources n'est disponible.
 * 4. Le nombre calcule ne peut pas depasser le total disponible dans les bacs
 * 5. Les poissons sont deduits des bacs proportionnellement
 */
export async function createVente(
  siteId: string,
  userId: string,
  data: CreateVenteDTO
) {
  return prisma.$transaction(async (tx) => {
    // Verify client belongs to site and is active
    const client = await tx.client.findFirst({
      where: { id: data.clientId, siteId, isActive: true },
    });
    if (!client) throw new Error("Client introuvable ou inactif");

    // Verify vague belongs to site
    const vague = await tx.vague.findFirst({
      where: { id: data.vagueId, siteId },
    });
    if (!vague) throw new Error("Vague introuvable");

    if (vague.statut === StatutVague.ANNULEE) {
      throw new Error("Impossible de vendre depuis une vague annulee");
    }

    // Resolve poidsMoyen (g) — manual override (DTO) or weighted average
    // of the last BIOMETRIE per bac (same logic as getIndicateursVague).
    let poidsMoyenG = data.poidsMoyenG;
    if (poidsMoyenG == null) {
      const vagueWithReleves = await tx.vague.findFirst({
        where: { id: data.vagueId, siteId },
        select: {
          nombreInitial: true,
          bacs: { select: { id: true, nombreInitial: true } },
          releves: {
            orderBy: { date: "asc" },
            select: {
              typeReleve: true,
              date: true,
              bacId: true,
              poidsMoyen: true,
              nombreMorts: true,
              nombreCompte: true,
            },
          },
        },
      });

      if (vagueWithReleves && vagueWithReleves.bacs.length > 0) {
        const biometriesParBac = new Map<string, number>();
        for (const r of vagueWithReleves.releves) {
          if (r.typeReleve === TypeReleve.BIOMETRIE && r.bacId && r.poidsMoyen != null) {
            biometriesParBac.set(r.bacId, r.poidsMoyen);
          }
        }

        if (biometriesParBac.size > 0) {
          const vivantsByBac = computeVivantsByBac(
            vagueWithReleves.bacs,
            vagueWithReleves.releves,
            vagueWithReleves.nombreInitial
          );
          let totalPoidsWeighted = 0;
          let totalVivantsForWeight = 0;
          for (const bac of vagueWithReleves.bacs) {
            const poids = biometriesParBac.get(bac.id);
            if (poids == null) continue;
            const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
            totalPoidsWeighted += poids * vivantsBac;
            totalVivantsForWeight += vivantsBac;
          }
          if (totalVivantsForWeight > 0) {
            poidsMoyenG = totalPoidsWeighted / totalVivantsForWeight;
          }
        }
      }
    }

    if (!poidsMoyenG || poidsMoyenG <= 0) {
      throw new Error(
        "Aucun poids moyen disponible pour cette vague. Saisissez-le manuellement ou enregistrez une biometrie."
      );
    }

    // Compute quantitePoissons from kg + average weight in grams
    const quantitePoissons = Math.max(
      1,
      Math.round((data.poidsTotalKg * 1000) / poidsMoyenG)
    );

    // Get all bacs of this vague with their fish count
    const bacs = await tx.bac.findMany({
      where: { vagueId: data.vagueId, siteId },
      orderBy: { nom: "asc" },
    });

    // Calculate total available fish
    const totalDisponible = bacs.reduce(
      (sum, bac) => sum + (bac.nombrePoissons ?? 0),
      0
    );

    if (quantitePoissons > totalDisponible) {
      throw new Error(
        `Stock poissons insuffisant. Disponible : ${totalDisponible}, calcule : ${quantitePoissons}`
      );
    }

    // Deduct fish proportionally from bacs
    let remaining = quantitePoissons;
    for (const bac of bacs) {
      if (remaining <= 0) break;
      const available = bac.nombrePoissons ?? 0;
      if (available <= 0) continue;

      const toDeduct = Math.min(remaining, available);
      const newCount = available - toDeduct;
      await tx.bac.update({
        where: { id: bac.id },
        data: { nombrePoissons: newCount },
      });
      // ADR-043 Phase 2: dual-write sur AssignationBac
      await tx.assignationBac.updateMany({
        where: { bacId: bac.id, vagueId: data.vagueId, dateFin: null },
        data: { nombreActuel: newCount },
      });
      remaining -= toDeduct;
    }

    // Generate numero VTE-YYYY-NNN (findFirst+orderBy to avoid race condition)
    const numero = await generateNextNumero(tx, "vente", "VTE", siteId);

    // Calculate montant
    const montantTotal = data.poidsTotalKg * data.prixUnitaireKg;

    // Create vente
    return tx.vente.create({
      data: {
        numero,
        clientId: data.clientId,
        vagueId: data.vagueId,
        quantitePoissons,
        poidsTotalKg: data.poidsTotalKg,
        prixUnitaireKg: data.prixUnitaireKg,
        montantTotal,
        dateCommande: data.dateCommande ? new Date(data.dateCommande) : new Date(),
        statut: StatutVente.EN_PREPARATION,
        notes: data.notes ?? null,
        userId,
        siteId,
      },
      include: {
        client: { select: { id: true, nom: true } },
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
      },
    });
  });
}

/**
 * Modifie une vente existante (transaction atomique).
 *
 * Si le poids ou la vague changent :
 * 1. Restituer les poissons de l'ancienne vente dans les bacs de l'ancienne vague
 * 2. Recalculer quantitePoissons avec le nouveau poids/poidsMoyen
 * 3. Deduire les poissons de la nouvelle vague
 *
 * Si la facture existe, son montantTotal est mis a jour.
 * Un SiteAuditLog est cree avec le motif et les valeurs avant/apres.
 */
export async function updateVente(
  venteId: string,
  siteId: string,
  userId: string,
  dto: UpdateVenteDTO
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: {
        facture: { select: { id: true } },
        vague: { select: { id: true, code: true } },
        client: { select: { id: true, nom: true } },
      },
    });
    if (!existing) throw new Error("Vente introuvable");

    if (existing.statut === StatutVente.CLOTUREE) {
      throw new Error("Une vente cloturee ne peut plus etre modifiee");
    }

    const newClientId = dto.clientId ?? existing.clientId;
    const newVagueId = dto.vagueId ?? existing.vagueId;
    const newPoidsTotalKg = dto.poidsTotalKg ?? existing.poidsTotalKg;
    const newPrixUnitaireKg = dto.prixUnitaireKg ?? existing.prixUnitaireKg;
    const newNotes = dto.notes !== undefined ? dto.notes : existing.notes;
    const newDateCommande = dto.dateCommande
      ? new Date(dto.dateCommande)
      : existing.dateCommande;

    // Validate new client
    if (newClientId !== existing.clientId) {
      const client = await tx.client.findFirst({
        where: { id: newClientId, siteId, isActive: true },
      });
      if (!client) throw new Error("Client introuvable ou inactif");
    }

    // Validate new vague
    if (newVagueId !== existing.vagueId) {
      const vague = await tx.vague.findFirst({
        where: { id: newVagueId, siteId },
      });
      if (!vague) throw new Error("Vague introuvable");
      if (vague.statut === StatutVague.ANNULEE) {
        throw new Error("Impossible de vendre depuis une vague annulee");
      }
    }

    const needsStockAdjust =
      newPoidsTotalKg !== existing.poidsTotalKg ||
      newVagueId !== existing.vagueId ||
      (dto.poidsMoyenG != null && dto.poidsMoyenG !== 0);

    let newQuantitePoissons = existing.quantitePoissons;

    if (needsStockAdjust) {
      // --- Step 1: Restore fish to old vague bacs ---
      const oldBacs = await tx.bac.findMany({
        where: { vagueId: existing.vagueId, siteId },
        orderBy: { nom: "asc" },
      });

      const totalOldFish = oldBacs.reduce(
        (sum, b) => sum + (b.nombrePoissons ?? 0),
        0
      );
      let toRestore = existing.quantitePoissons;
      for (const bac of oldBacs) {
        if (toRestore <= 0) break;
        const current = bac.nombrePoissons ?? 0;
        // Distribute proportionally based on current share, or equally if all empty
        const share =
          totalOldFish > 0
            ? Math.round((current / totalOldFish) * existing.quantitePoissons)
            : Math.round(existing.quantitePoissons / oldBacs.length);
        const restore = Math.min(toRestore, share || toRestore);
        const newCount = current + restore;
        await tx.bac.update({
          where: { id: bac.id },
          data: { nombrePoissons: newCount },
        });
        await tx.assignationBac.updateMany({
          where: { bacId: bac.id, vagueId: existing.vagueId, dateFin: null },
          data: { nombreActuel: newCount },
        });
        toRestore -= restore;
      }
      // If rounding left some fish unrestored, add to last bac
      if (toRestore > 0 && oldBacs.length > 0) {
        const lastBac = oldBacs[oldBacs.length - 1];
        const lastCount = (lastBac.nombrePoissons ?? 0) +
          existing.quantitePoissons -
          (existing.quantitePoissons - toRestore);
        await tx.bac.update({
          where: { id: lastBac.id },
          data: { nombrePoissons: { increment: toRestore } },
        });
        await tx.assignationBac.updateMany({
          where: { bacId: lastBac.id, vagueId: existing.vagueId, dateFin: null },
          data: { nombreActuel: lastCount },
        });
      }

      // --- Step 2: Resolve poidsMoyenG for new vague ---
      let poidsMoyenG = dto.poidsMoyenG;
      if (poidsMoyenG == null) {
        const vagueWithReleves = await tx.vague.findFirst({
          where: { id: newVagueId, siteId },
          select: {
            nombreInitial: true,
            bacs: { select: { id: true, nombreInitial: true } },
            releves: {
              orderBy: { date: "asc" },
              select: {
                typeReleve: true,
                date: true,
                bacId: true,
                poidsMoyen: true,
                nombreMorts: true,
                nombreCompte: true,
              },
            },
          },
        });

        if (vagueWithReleves && vagueWithReleves.bacs.length > 0) {
          const biometriesParBac = new Map<string, number>();
          for (const r of vagueWithReleves.releves) {
            if (r.typeReleve === TypeReleve.BIOMETRIE && r.bacId && r.poidsMoyen != null) {
              biometriesParBac.set(r.bacId, r.poidsMoyen);
            }
          }

          if (biometriesParBac.size > 0) {
            const vivantsByBac = computeVivantsByBac(
              vagueWithReleves.bacs,
              vagueWithReleves.releves,
              vagueWithReleves.nombreInitial
            );
            let totalPoidsWeighted = 0;
            let totalVivantsForWeight = 0;
            for (const bac of vagueWithReleves.bacs) {
              const poids = biometriesParBac.get(bac.id);
              if (poids == null) continue;
              const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
              totalPoidsWeighted += poids * vivantsBac;
              totalVivantsForWeight += vivantsBac;
            }
            if (totalVivantsForWeight > 0) {
              poidsMoyenG = totalPoidsWeighted / totalVivantsForWeight;
            }
          }
        }
      }

      if (!poidsMoyenG || poidsMoyenG <= 0) {
        throw new Error(
          "Aucun poids moyen disponible pour cette vague. Saisissez-le manuellement ou enregistrez une biometrie."
        );
      }

      // --- Step 3: Calculate new quantity and deduct from new vague bacs ---
      newQuantitePoissons = Math.max(
        1,
        Math.round((newPoidsTotalKg * 1000) / poidsMoyenG)
      );

      const newBacs = await tx.bac.findMany({
        where: { vagueId: newVagueId, siteId },
        orderBy: { nom: "asc" },
      });

      const totalDisponible = newBacs.reduce(
        (sum, b) => sum + (b.nombrePoissons ?? 0),
        0
      );

      if (newQuantitePoissons > totalDisponible) {
        throw new Error(
          `Stock poissons insuffisant. Disponible : ${totalDisponible}, calcule : ${newQuantitePoissons}`
        );
      }

      let remaining = newQuantitePoissons;
      for (const bac of newBacs) {
        if (remaining <= 0) break;
        const available = bac.nombrePoissons ?? 0;
        if (available <= 0) continue;
        const toDeduct = Math.min(remaining, available);
        const newCount = available - toDeduct;
        await tx.bac.update({
          where: { id: bac.id },
          data: { nombrePoissons: newCount },
        });
        await tx.assignationBac.updateMany({
          where: { bacId: bac.id, vagueId: newVagueId, dateFin: null },
          data: { nombreActuel: newCount },
        });
        remaining -= toDeduct;
      }
    }

    const newMontantTotal = newPoidsTotalKg * newPrixUnitaireKg;

    // Update the vente
    const updated = await tx.vente.update({
      where: { id: venteId },
      data: {
        clientId: newClientId,
        vagueId: newVagueId,
        poidsTotalKg: newPoidsTotalKg,
        prixUnitaireKg: newPrixUnitaireKg,
        quantitePoissons: newQuantitePoissons,
        montantTotal: newMontantTotal,
        dateCommande: newDateCommande,
        notes: newNotes,
      },
      include: {
        client: { select: { id: true, nom: true } },
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        facture: { select: { id: true, numero: true, statut: true, montantPaye: true, montantTotal: true } },
      },
    });

    // Update facture if exists
    if (existing.facture && newMontantTotal !== existing.montantTotal) {
      await tx.facture.update({
        where: { id: existing.facture.id },
        data: { montantTotal: newMontantTotal },
      });
    }

    // Audit log
    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "VENTE_MODIFIEE",
        details: {
          motif: dto.motif,
          before: {
            clientId: existing.clientId,
            clientNom: existing.client.nom,
            vagueId: existing.vagueId,
            vagueCode: existing.vague.code,
            poidsTotalKg: existing.poidsTotalKg,
            prixUnitaireKg: existing.prixUnitaireKg,
            quantitePoissons: existing.quantitePoissons,
            montantTotal: existing.montantTotal,
            dateCommande: existing.dateCommande,
            notes: existing.notes,
          },
          after: {
            clientId: updated.clientId,
            clientNom: updated.client.nom,
            vagueId: updated.vagueId,
            vagueCode: updated.vague.code,
            poidsTotalKg: updated.poidsTotalKg,
            prixUnitaireKg: updated.prixUnitaireKg,
            quantitePoissons: updated.quantitePoissons,
            montantTotal: updated.montantTotal,
            dateCommande: updated.dateCommande,
            notes: updated.notes,
          },
        },
      },
    });

    return updated;
  });
}

/**
 * Cloture une vente apres livraison (transaction atomique).
 *
 * 1. Valide statut EN_PREPARATION et 0 < poidsLivreKg <= poidsTotalKg
 * 2. Calcule quantiteLivree et nombreMorts a partir du poidsMoyenG
 * 3. Si perte > 0 : cree des releves MORTALITE/AVARIE proportionnels par bac
 *    et decremente Bac.nombrePoissons + AssignationBac.nombreActuel
 * 4. Recalcule montantTotal sur le poids livre
 * 5. Met a jour la facture si elle existe
 * 6. Cree un SiteAuditLog VENTE_CLOTUREE
 */
export async function cloturerVente(
  venteId: string,
  siteId: string,
  userId: string,
  dto: ClotureVenteDTO
) {
  return prisma.$transaction(async (tx) => {
    const vente = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: {
        facture: { select: { id: true } },
        vague: { select: { id: true, code: true, nombreInitial: true } },
        client: { select: { id: true, nom: true } },
      },
    });
    if (!vente) throw new Error("Vente introuvable");

    if (vente.statut !== StatutVente.EN_PREPARATION) {
      throw new Error("Cette vente est deja cloturee");
    }

    if (dto.poidsLivreKg <= 0) {
      throw new Error("Le poids livre doit etre superieur a 0");
    }
    if (dto.poidsLivreKg > vente.poidsTotalKg) {
      throw new Error(
        `Le poids livre (${dto.poidsLivreKg} kg) ne peut pas depasser le poids commande (${vente.poidsTotalKg} kg)`
      );
    }

    const poidsMoyenG = (vente.poidsTotalKg * 1000) / vente.quantitePoissons;
    const quantiteLivree = Math.min(
      vente.quantitePoissons,
      Math.max(1, Math.round((dto.poidsLivreKg * 1000) / poidsMoyenG))
    );
    const nombreMorts = vente.quantitePoissons - quantiteLivree;

    const newMontantTotal = dto.poidsLivreKg * vente.prixUnitaireKg;
    const dateLivraison = dto.dateLivraison ? new Date(dto.dateLivraison) : new Date();

    // If loss > 0, create AVARIE releves and decrement bac fish counts
    if (nombreMorts > 0) {
      const bacs = await tx.bac.findMany({
        where: { vagueId: vente.vagueId, siteId },
        orderBy: { nom: "asc" },
      });

      const totalFish = bacs.reduce((sum, b) => sum + (b.nombrePoissons ?? 0), 0);

      let mortsRestants = nombreMorts;
      for (const bac of bacs) {
        if (mortsRestants <= 0) break;
        const available = bac.nombrePoissons ?? 0;
        if (available <= 0) continue;

        // Proportional distribution
        const share = totalFish > 0
          ? Math.round((available / totalFish) * nombreMorts)
          : Math.round(nombreMorts / bacs.length);
        const mortsForBac = Math.min(mortsRestants, Math.min(share || 1, available));
        const newCount = available - mortsForBac;

        await tx.bac.update({
          where: { id: bac.id },
          data: { nombrePoissons: newCount },
        });
        await tx.assignationBac.updateMany({
          where: { bacId: bac.id, vagueId: vente.vagueId, dateFin: null },
          data: { nombreActuel: newCount },
        });

        await tx.releve.create({
          data: {
            date: dateLivraison,
            typeReleve: TypeReleve.MORTALITE,
            vagueId: vente.vagueId,
            bacId: bac.id,
            siteId,
            userId,
            nombreMorts: mortsForBac,
            causeMortalite: CauseMortalite.AVARIE,
            notes: `Perte transport vente ${vente.numero} — ${mortsForBac} poissons`,
          },
        });

        mortsRestants -= mortsForBac;
      }

      // Rounding remainder goes to last bac with fish
      if (mortsRestants > 0 && bacs.length > 0) {
        for (let i = bacs.length - 1; i >= 0; i--) {
          const bac = bacs[i];
          const currentFish = (bac.nombrePoissons ?? 0) -
            (nombreMorts - mortsRestants > 0 ? 0 : 0);
          // Re-read actual count after previous updates
          const freshBac = await tx.bac.findUnique({ where: { id: bac.id } });
          const freshCount = freshBac?.nombrePoissons ?? 0;
          if (freshCount <= 0) continue;

          const extra = Math.min(mortsRestants, freshCount);
          await tx.bac.update({
            where: { id: bac.id },
            data: { nombrePoissons: freshCount - extra },
          });
          await tx.assignationBac.updateMany({
            where: { bacId: bac.id, vagueId: vente.vagueId, dateFin: null },
            data: { nombreActuel: freshCount - extra },
          });
          mortsRestants -= extra;
          if (mortsRestants <= 0) break;
        }
      }
    }

    // Update the vente
    const updated = await tx.vente.update({
      where: { id: venteId },
      data: {
        statut: StatutVente.LIVREE,
        poidsCommandeKg: vente.poidsTotalKg,
        quantiteCommandee: vente.quantitePoissons,
        poidsLivreKg: dto.poidsLivreKg,
        quantiteLivree,
        poidsTotalKg: dto.poidsLivreKg,
        quantitePoissons: quantiteLivree,
        dateLivraison,
        montantTotal: newMontantTotal,
      },
      include: {
        client: { select: { id: true, nom: true } },
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        facture: { select: { id: true, numero: true, statut: true, montantPaye: true, montantTotal: true } },
      },
    });

    // Update facture if exists
    if (vente.facture) {
      await tx.facture.update({
        where: { id: vente.facture.id },
        data: { montantTotal: newMontantTotal },
      });
    }

    // Audit log
    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "VENTE_CLOTUREE",
        details: {
          venteNumero: vente.numero,
          clientNom: vente.client.nom,
          vagueCode: vente.vague.code,
          poidsCommande: vente.poidsTotalKg,
          poidsLivre: dto.poidsLivreKg,
          pertePoids: vente.poidsTotalKg - dto.poidsLivreKg,
          quantiteCommandee: vente.quantitePoissons,
          quantiteLivree,
          nombreMorts,
          ancienMontant: vente.montantTotal,
          nouveauMontant: newMontantTotal,
          dateLivraison: dateLivraison.toISOString(),
        },
      },
    });

    return updated;
  });
}

/**
 * Cloture definitive d'une vente (LIVREE → CLOTUREE).
 * Etat terminal : plus aucune modification possible.
 */
export async function cloturerDefinitivement(
  venteId: string,
  siteId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const vente = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: {
        client: { select: { nom: true } },
        vague: { select: { code: true } },
        facture: { select: { id: true, statut: true, montantTotal: true, montantPaye: true } },
      },
    });
    if (!vente) throw new Error("Vente introuvable");

    if (vente.statut !== StatutVente.LIVREE) {
      throw new Error("Seule une vente livree peut etre cloturee definitivement");
    }

    const updated = await tx.vente.update({
      where: { id: venteId },
      data: { statut: StatutVente.CLOTUREE },
      include: {
        client: { select: { id: true, nom: true } },
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        facture: { select: { id: true, numero: true, statut: true, montantPaye: true, montantTotal: true } },
      },
    });

    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "VENTE_CLOTUREE_DEFINITIVEMENT",
        details: {
          venteNumero: vente.numero,
          clientNom: vente.client.nom,
          vagueCode: vente.vague.code,
          montantTotal: vente.montantTotal,
          factureStatut: vente.facture?.statut ?? null,
        },
      },
    });

    return updated;
  });
}
