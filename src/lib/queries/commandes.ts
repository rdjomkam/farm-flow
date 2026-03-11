import { prisma } from "@/lib/db";
import { StatutCommande, TypeMouvement } from "@/types";
import type { CreateCommandeDTO, CommandeFilters } from "@/types";

/** Liste les commandes d'un site avec filtres */
export async function getCommandes(siteId: string, filters?: CommandeFilters) {
  return prisma.commande.findMany({
    where: {
      siteId,
      ...(filters?.statut && { statut: filters.statut }),
      ...(filters?.fournisseurId && { fournisseurId: filters.fournisseurId }),
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            dateCommande: {
              ...(filters?.dateFrom && { gte: new Date(filters.dateFrom) }),
              ...(filters?.dateTo && { lte: new Date(filters.dateTo) }),
            },
          }
        : {}),
    },
    include: {
      fournisseur: { select: { id: true, nom: true } },
      user: { select: { id: true, name: true } },
      _count: { select: { lignes: true } },
    },
    orderBy: { dateCommande: "desc" },
  });
}

/** Recupere une commande par ID avec ses lignes */
export async function getCommandeById(id: string, siteId: string) {
  return prisma.commande.findFirst({
    where: { id, siteId },
    include: {
      fournisseur: { select: { id: true, nom: true, telephone: true, email: true } },
      user: { select: { id: true, name: true } },
      lignes: {
        include: {
          produit: { select: { id: true, nom: true, unite: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      mouvements: {
        include: {
          produit: { select: { id: true, nom: true } },
        },
        orderBy: { date: "desc" },
      },
    },
  });
}

/** Cree une commande avec ses lignes */
export async function createCommande(
  siteId: string,
  userId: string,
  data: CreateCommandeDTO
) {
  return prisma.$transaction(async (tx) => {
    // Verify fournisseur belongs to site
    const fournisseur = await tx.fournisseur.findFirst({
      where: { id: data.fournisseurId, siteId },
    });
    if (!fournisseur) throw new Error("Fournisseur introuvable");

    // Verify all products belong to site
    const produitIds = data.lignes.map((l) => l.produitId);
    const produits = await tx.produit.findMany({
      where: { id: { in: produitIds }, siteId },
    });
    if (produits.length !== produitIds.length) {
      throw new Error("Un ou plusieurs produits introuvables");
    }

    // Calculate total
    const montantTotal = data.lignes.reduce(
      (sum, l) => sum + l.quantite * l.prixUnitaire,
      0
    );

    // Generate numero
    const year = new Date().getFullYear();
    const count = await tx.commande.count({
      where: { siteId, numero: { startsWith: `CMD-${year}` } },
    });
    const numero = `CMD-${year}-${String(count + 1).padStart(3, "0")}`;

    // Create commande + lignes
    return tx.commande.create({
      data: {
        numero,
        fournisseurId: data.fournisseurId,
        dateCommande: new Date(data.dateCommande),
        montantTotal,
        userId,
        siteId,
        lignes: {
          create: data.lignes.map((l) => ({
            produitId: l.produitId,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
          })),
        },
      },
      include: {
        fournisseur: { select: { id: true, nom: true } },
        lignes: {
          include: { produit: { select: { id: true, nom: true, unite: true } } },
        },
      },
    });
  });
}

/** Envoie une commande (BROUILLON -> ENVOYEE) */
export async function envoyerCommande(id: string, siteId: string) {
  return prisma.$transaction(async (tx) => {
    const commande = await tx.commande.findFirst({
      where: { id, siteId },
    });

    if (!commande) throw new Error("Commande introuvable");

    if (commande.statut !== StatutCommande.BROUILLON) {
      throw new Error(
        `Impossible d'envoyer une commande avec le statut ${commande.statut}. La commande doit etre en statut BROUILLON.`
      );
    }

    return tx.commande.update({
      where: { id: commande.id },
      data: { statut: StatutCommande.ENVOYEE },
      include: {
        fournisseur: { select: { id: true, nom: true } },
        _count: { select: { lignes: true } },
      },
    });
  });
}

/**
 * Recoit une commande :
 * 1. Verifie que la commande est en statut ENVOYEE
 * 2. Cree un mouvement ENTREE pour chaque ligne
 * 3. Met a jour le stockActuel de chaque produit
 * 4. Change le statut en LIVREE + date de livraison
 */
export async function recevoirCommande(
  id: string,
  siteId: string,
  userId: string,
  dateLivraison?: string
) {
  return prisma.$transaction(async (tx) => {
    // Get commande with lignes
    const commande = await tx.commande.findFirst({
      where: { id, siteId },
      include: { lignes: true },
    });

    if (!commande) throw new Error("Commande introuvable");

    if (commande.statut !== StatutCommande.ENVOYEE) {
      throw new Error(
        `Impossible de recevoir une commande avec le statut ${commande.statut}. La commande doit etre en statut ENVOYEE.`
      );
    }

    const livraisonDate = dateLivraison ? new Date(dateLivraison) : new Date();

    // Create ENTREE mouvement for each ligne + update stock
    for (const ligne of commande.lignes) {
      await tx.mouvementStock.create({
        data: {
          produitId: ligne.produitId,
          type: TypeMouvement.ENTREE,
          quantite: ligne.quantite,
          prixTotal: ligne.quantite * ligne.prixUnitaire,
          commandeId: commande.id,
          userId,
          date: livraisonDate,
          notes: `Reception commande ${commande.numero}`,
          siteId,
        },
      });

      await tx.produit.update({
        where: { id: ligne.produitId },
        data: { stockActuel: { increment: ligne.quantite } },
      });
    }

    // Update commande statut + date livraison
    return tx.commande.update({
      where: { id: commande.id },
      data: {
        statut: StatutCommande.LIVREE,
        dateLivraison: livraisonDate,
      },
      include: {
        fournisseur: { select: { id: true, nom: true } },
        lignes: {
          include: { produit: { select: { id: true, nom: true, unite: true } } },
        },
      },
    });
  });
}

/** Annule une commande (uniquement si BROUILLON ou ENVOYEE) */
export async function annulerCommande(id: string, siteId: string) {
  return prisma.$transaction(async (tx) => {
    const commande = await tx.commande.findFirst({
      where: { id, siteId },
    });

    if (!commande) throw new Error("Commande introuvable");

    if (commande.statut === StatutCommande.LIVREE) {
      throw new Error("Impossible d'annuler une commande deja livree");
    }

    if (commande.statut === StatutCommande.ANNULEE) {
      throw new Error("Cette commande est deja annulee");
    }

    return tx.commande.update({
      where: { id: commande.id },
      data: { statut: StatutCommande.ANNULEE },
      include: {
        fournisseur: { select: { id: true, nom: true } },
      },
    });
  });
}
