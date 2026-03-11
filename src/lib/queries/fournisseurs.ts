import { prisma } from "@/lib/db";
import type { CreateFournisseurDTO, UpdateFournisseurDTO } from "@/types";

/** Liste tous les fournisseurs actifs d'un site */
export async function getFournisseurs(siteId: string) {
  return prisma.fournisseur.findMany({
    where: { siteId, isActive: true },
    include: {
      _count: { select: { produits: true, commandes: true } },
    },
    orderBy: { nom: "asc" },
  });
}

/** Recupere un fournisseur par ID (verifie siteId) */
export async function getFournisseurById(id: string, siteId: string) {
  return prisma.fournisseur.findFirst({
    where: { id, siteId },
    include: {
      produits: { where: { isActive: true }, orderBy: { nom: "asc" } },
      commandes: { orderBy: { dateCommande: "desc" }, take: 10 },
      _count: { select: { produits: true, commandes: true } },
    },
  });
}

/** Cree un fournisseur */
export async function createFournisseur(siteId: string, data: CreateFournisseurDTO) {
  return prisma.fournisseur.create({
    data: {
      nom: data.nom,
      telephone: data.telephone ?? null,
      email: data.email ?? null,
      adresse: data.adresse ?? null,
      siteId,
    },
  });
}

/** Met a jour un fournisseur */
export async function updateFournisseur(
  id: string,
  siteId: string,
  data: UpdateFournisseurDTO
) {
  const result = await prisma.fournisseur.updateMany({
    where: { id, siteId },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.telephone !== undefined && { telephone: data.telephone || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.adresse !== undefined && { adresse: data.adresse || null }),
    },
  });

  if (result.count === 0) {
    throw new Error("Fournisseur introuvable");
  }

  return prisma.fournisseur.findFirst({ where: { id, siteId } });
}

/** Desactive un fournisseur (soft delete) */
export async function deleteFournisseur(id: string, siteId: string) {
  const result = await prisma.fournisseur.updateMany({
    where: { id, siteId },
    data: { isActive: false },
  });

  if (result.count === 0) {
    throw new Error("Fournisseur introuvable");
  }
}
