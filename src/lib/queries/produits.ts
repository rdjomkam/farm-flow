import { prisma } from "@/lib/db";
import { CategorieProduit } from "@/types";
import type { CreateProduitDTO, UpdateProduitDTO, ProduitFilters } from "@/types";

/** Liste tous les produits actifs d'un site */
export async function getProduits(siteId: string, filters?: ProduitFilters) {
  return prisma.produit.findMany({
    where: {
      siteId,
      isActive: true,
      ...(filters?.categorie && { categorie: filters.categorie }),
      ...(filters?.fournisseurId && { fournisseurId: filters.fournisseurId }),
    },
    include: {
      fournisseur: { select: { id: true, nom: true } },
      _count: { select: { mouvements: true } },
    },
    orderBy: { nom: "asc" },
  });
}

/** Recupere un produit par ID (verifie siteId) */
export async function getProduitById(id: string, siteId: string) {
  return prisma.produit.findFirst({
    where: { id, siteId },
    include: {
      fournisseur: { select: { id: true, nom: true } },
      mouvements: {
        orderBy: { date: "desc" },
        take: 20,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}

/** Liste les produits dont le stock est en dessous du seuil d'alerte */
export async function getProduitsEnAlerte(siteId: string) {
  const produits = await prisma.produit.findMany({
    where: {
      siteId,
      isActive: true,
      seuilAlerte: { gt: 0 },
    },
    include: {
      fournisseur: { select: { id: true, nom: true } },
    },
    orderBy: { stockActuel: "asc" },
  });

  return produits.filter((p) => p.stockActuel <= p.seuilAlerte);
}

/** Cree un produit */
export async function createProduit(siteId: string, data: CreateProduitDTO) {
  // Verify fournisseur belongs to same site if provided
  if (data.fournisseurId) {
    const fournisseur = await prisma.fournisseur.findFirst({
      where: { id: data.fournisseurId, siteId },
    });
    if (!fournisseur) throw new Error("Fournisseur introuvable");
  }

  return prisma.produit.create({
    data: {
      nom: data.nom,
      categorie: data.categorie,
      unite: data.unite,
      prixUnitaire: data.prixUnitaire,
      seuilAlerte: data.seuilAlerte ?? 0,
      fournisseurId: data.fournisseurId ?? null,
      siteId,
    },
    include: {
      fournisseur: { select: { id: true, nom: true } },
    },
  });
}

/** Met a jour un produit */
export async function updateProduit(
  id: string,
  siteId: string,
  data: UpdateProduitDTO
) {
  // Verify fournisseur belongs to same site if provided
  if (data.fournisseurId) {
    const fournisseur = await prisma.fournisseur.findFirst({
      where: { id: data.fournisseurId, siteId },
    });
    if (!fournisseur) throw new Error("Fournisseur introuvable");
  }

  const result = await prisma.produit.updateMany({
    where: { id, siteId },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.categorie !== undefined && { categorie: data.categorie }),
      ...(data.unite !== undefined && { unite: data.unite }),
      ...(data.prixUnitaire !== undefined && { prixUnitaire: data.prixUnitaire }),
      ...(data.seuilAlerte !== undefined && { seuilAlerte: data.seuilAlerte }),
      ...(data.fournisseurId !== undefined && { fournisseurId: data.fournisseurId }),
    },
  });

  if (result.count === 0) {
    throw new Error("Produit introuvable");
  }

  return prisma.produit.findFirst({
    where: { id, siteId },
    include: { fournisseur: { select: { id: true, nom: true } } },
  });
}

/** Desactive un produit (soft delete) */
export async function deleteProduit(id: string, siteId: string) {
  const result = await prisma.produit.updateMany({
    where: { id, siteId },
    data: { isActive: false },
  });

  if (result.count === 0) {
    throw new Error("Produit introuvable");
  }
}
