import { prisma } from "@/lib/db";
import { generateNextNumero } from "./numero-utils";
import { StatutVague, TypeReleve } from "@/types";
import { computeVivantsByBac } from "@/lib/calculs";
import type { CreateVenteDTO, VenteFilters } from "@/types";

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
        data: { nombrePoissons: newCount },
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
