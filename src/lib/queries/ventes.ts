import { prisma } from "@/lib/db";
import { StatutVague } from "@/types";
import type { CreateVenteDTO, VenteFilters } from "@/types";

/** Liste les ventes d'un site avec filtres */
export async function getVentes(siteId: string, filters?: VenteFilters) {
  return prisma.vente.findMany({
    where: {
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
    },
    include: {
      client: { select: { id: true, nom: true } },
      vague: { select: { id: true, code: true } },
      user: { select: { id: true, name: true } },
      facture: { select: { id: true, numero: true, statut: true, montantPaye: true } },
    },
    orderBy: { createdAt: "desc" },
  });
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
 * 3. La quantite de poissons vendus ne peut pas depasser le total disponible
 *    dans les bacs de la vague
 * 4. Les poissons sont deduits des bacs proportionnellement
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

    if (data.quantitePoissons > totalDisponible) {
      throw new Error(
        `Stock poissons insuffisant. Disponible : ${totalDisponible}, demande : ${data.quantitePoissons}`
      );
    }

    // Deduct fish proportionally from bacs
    let remaining = data.quantitePoissons;
    for (const bac of bacs) {
      if (remaining <= 0) break;
      const available = bac.nombrePoissons ?? 0;
      if (available <= 0) continue;

      const toDeduct = Math.min(remaining, available);
      await tx.bac.update({
        where: { id: bac.id },
        data: { nombrePoissons: available - toDeduct },
      });
      remaining -= toDeduct;
    }

    // Generate numero
    const year = new Date().getFullYear();
    const count = await tx.vente.count({
      where: { siteId, numero: { startsWith: `VTE-${year}` } },
    });
    const numero = `VTE-${year}-${String(count + 1).padStart(3, "0")}`;

    // Calculate montant
    const montantTotal = data.poidsTotalKg * data.prixUnitaireKg;

    // Create vente
    return tx.vente.create({
      data: {
        numero,
        clientId: data.clientId,
        vagueId: data.vagueId,
        quantitePoissons: data.quantitePoissons,
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
