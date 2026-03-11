import { prisma } from "@/lib/db";
import { TypeMouvement } from "@/types";
import type { CreateMouvementDTO, MouvementFilters } from "@/types";

/** Liste les mouvements de stock d'un site avec filtres */
export async function getMouvements(siteId: string, filters?: MouvementFilters) {
  return prisma.mouvementStock.findMany({
    where: {
      siteId,
      ...(filters?.produitId && { produitId: filters.produitId }),
      ...(filters?.type && { type: filters.type }),
      ...(filters?.vagueId && { vagueId: filters.vagueId }),
      ...(filters?.commandeId && { commandeId: filters.commandeId }),
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            date: {
              ...(filters?.dateFrom && { gte: new Date(filters.dateFrom) }),
              ...(filters?.dateTo && { lte: new Date(filters.dateTo) }),
            },
          }
        : {}),
    },
    include: {
      produit: { select: { id: true, nom: true, unite: true } },
      user: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
      commande: { select: { id: true, numero: true } },
    },
    orderBy: { date: "desc" },
  });
}

/**
 * Cree un mouvement de stock.
 * - ENTREE : incremente stockActuel du produit
 * - SORTIE : decremente stockActuel (refuse si stock insuffisant)
 */
export async function createMouvement(
  siteId: string,
  userId: string,
  data: CreateMouvementDTO
) {
  return prisma.$transaction(async (tx) => {
    // Verify produit belongs to site
    const produit = await tx.produit.findFirst({
      where: { id: data.produitId, siteId },
    });
    if (!produit) throw new Error("Produit introuvable");

    // For SORTIE, check sufficient stock
    if (data.type === TypeMouvement.SORTIE && produit.stockActuel < data.quantite) {
      throw new Error(
        `Stock insuffisant pour ${produit.nom}. Disponible : ${produit.stockActuel} ${produit.unite}, demande : ${data.quantite} ${produit.unite}`
      );
    }

    // Verify vague belongs to site if provided
    if (data.vagueId) {
      const vague = await tx.vague.findFirst({
        where: { id: data.vagueId, siteId },
      });
      if (!vague) throw new Error("Vague introuvable");
    }

    // Verify commande belongs to site if provided
    if (data.commandeId) {
      const commande = await tx.commande.findFirst({
        where: { id: data.commandeId, siteId },
      });
      if (!commande) throw new Error("Commande introuvable");
    }

    // Create mouvement
    const mouvement = await tx.mouvementStock.create({
      data: {
        produitId: data.produitId,
        type: data.type,
        quantite: data.quantite,
        prixTotal: data.prixTotal ?? null,
        vagueId: data.vagueId ?? null,
        commandeId: data.commandeId ?? null,
        userId,
        date: new Date(data.date),
        notes: data.notes ?? null,
        siteId,
      },
      include: {
        produit: { select: { id: true, nom: true, unite: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // Update stock
    const delta = data.type === TypeMouvement.ENTREE ? data.quantite : -data.quantite;
    await tx.produit.update({
      where: { id: data.produitId },
      data: { stockActuel: { increment: delta } },
    });

    return mouvement;
  });
}
