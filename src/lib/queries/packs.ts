import { prisma } from "@/lib/db";
import { StatutActivation } from "@/types";
import type {
  CreatePackDTO,
  UpdatePackDTO,
  CreatePackProduitDTO,
  PackFilters,
  PackActivationFilters,
} from "@/types";

// ---------------------------------------------------------------------------
// Pack — CRUD queries
// ---------------------------------------------------------------------------

/**
 * Recupere tous les packs du site actif.
 */
export async function getPacks(siteId: string, filters?: PackFilters) {
  const where = {
    siteId,
    ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters?.configElevageId && { configElevageId: filters.configElevageId }),
  };

  const packs = await prisma.pack.findMany({
    where,
    include: {
      configElevage: { select: { id: true, nom: true } },
      user: { select: { id: true, name: true } },
      produits: {
        include: {
          produit: {
            select: { id: true, nom: true, categorie: true, unite: true, prixUnitaire: true, stockActuel: true },
          },
        },
      },
      _count: { select: { activations: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return packs;
}

/**
 * Recupere un pack par son ID avec toutes les relations.
 */
export async function getPackById(id: string, siteId: string) {
  return prisma.pack.findFirst({
    where: { id, siteId },
    include: {
      configElevage: { select: { id: true, nom: true, poidsObjectif: true, dureeEstimeeCycle: true } },
      user: { select: { id: true, name: true } },
      produits: {
        include: {
          produit: {
            select: { id: true, nom: true, categorie: true, unite: true, prixUnitaire: true, stockActuel: true },
          },
        },
      },
      activations: {
        select: {
          id: true,
          code: true,
          statut: true,
          dateActivation: true,
          dateExpiration: true,
          clientSite: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { dateActivation: "desc" },
      },
    },
  });
}

/**
 * Cree un nouveau Pack.
 * Validation business : nombreAlevins > 0, prixTotal >= 0
 */
export async function createPack(data: CreatePackDTO & { userId: string; siteId: string }) {
  if (data.nombreAlevins <= 0) {
    throw new Error("Le nombre d'alevins doit etre superieur a 0.");
  }
  if ((data.prixTotal ?? 0) < 0) {
    throw new Error("Le prix total ne peut pas etre negatif.");
  }

  return prisma.pack.create({
    data: {
      nom: data.nom,
      description: data.description,
      nombreAlevins: data.nombreAlevins,
      poidsMoyenInitial: data.poidsMoyenInitial ?? 5,
      prixTotal: data.prixTotal ?? 0,
      configElevageId: data.configElevageId ?? null,
      isActive: data.isActive ?? true,
      userId: data.userId,
      siteId: data.siteId,
    },
    include: {
      configElevage: { select: { id: true, nom: true } },
      user: { select: { id: true, name: true } },
      produits: {
        include: {
          produit: {
            select: { id: true, nom: true, categorie: true, unite: true, prixUnitaire: true, stockActuel: true },
          },
        },
      },
    },
  });
}

/**
 * Met a jour un Pack.
 * Empeche la modification si des activations ACTIVE existent (EC-1.5 — pour desactivation).
 */
export async function updatePack(id: string, siteId: string, data: UpdatePackDTO) {
  // Verifier l'existence
  const pack = await prisma.pack.findFirst({ where: { id, siteId } });
  if (!pack) {
    return null;
  }

  // EC-1.5 : empêcher la désactivation si des activations ACTIVE existent
  if (data.isActive === false && pack.isActive) {
    const activeActivations = await prisma.packActivation.count({
      where: { packId: id, statut: StatutActivation.ACTIVE },
    });
    if (activeActivations > 0) {
      throw new Error(
        `Impossible de desactiver ce pack : ${activeActivations} activation(s) active(s) en cours.`
      );
    }
  }

  return prisma.pack.update({
    where: { id },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.nombreAlevins !== undefined && { nombreAlevins: data.nombreAlevins }),
      ...(data.poidsMoyenInitial !== undefined && { poidsMoyenInitial: data.poidsMoyenInitial }),
      ...(data.prixTotal !== undefined && { prixTotal: data.prixTotal }),
      ...(data.configElevageId !== undefined && { configElevageId: data.configElevageId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: {
      configElevage: { select: { id: true, nom: true } },
      user: { select: { id: true, name: true } },
      produits: {
        include: {
          produit: {
            select: { id: true, nom: true, categorie: true, unite: true, prixUnitaire: true, stockActuel: true },
          },
        },
      },
    },
  });
}

/**
 * Supprime un Pack.
 * Refuse si des activations existent (au moins une ACTIVE).
 */
export async function deletePack(id: string, siteId: string): Promise<boolean> {
  const pack = await prisma.pack.findFirst({ where: { id, siteId } });
  if (!pack) return false;

  const activeActivations = await prisma.packActivation.count({
    where: { packId: id, statut: StatutActivation.ACTIVE },
  });
  if (activeActivations > 0) {
    throw new Error(
      `Impossible de supprimer ce pack : ${activeActivations} activation(s) active(s) en cours.`
    );
  }

  await prisma.pack.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------------------
// PackProduit — CRUD queries
// ---------------------------------------------------------------------------

/**
 * Recupere les produits d'un Pack.
 */
export async function getPackProduits(packId: string, siteId: string) {
  // Verifier que le pack appartient au site
  const pack = await prisma.pack.findFirst({ where: { id: packId, siteId } });
  if (!pack) return null;

  return prisma.packProduit.findMany({
    where: { packId },
    include: {
      produit: {
        select: { id: true, nom: true, categorie: true, unite: true, prixUnitaire: true, stockActuel: true },
      },
    },
    orderBy: { id: "asc" },
  });
}

/**
 * Ajoute un produit dans un Pack.
 * EC-1.3 : quantite > 0
 * Contrainte unique (packId, produitId) gérée par la DB.
 */
export async function addPackProduit(
  packId: string,
  siteId: string,
  data: CreatePackProduitDTO
) {
  // Verifier que le pack appartient au site
  const pack = await prisma.pack.findFirst({ where: { id: packId, siteId } });
  if (!pack) return null;

  if (data.quantite <= 0) {
    throw new Error("La quantite doit etre superieure a 0.");
  }

  return prisma.packProduit.create({
    data: {
      packId,
      produitId: data.produitId,
      quantite: data.quantite,
    },
    include: {
      produit: {
        select: { id: true, nom: true, categorie: true, unite: true, prixUnitaire: true, stockActuel: true },
      },
    },
  });
}

/**
 * Supprime un produit d'un Pack.
 */
export async function removePackProduit(
  packId: string,
  produitId: string,
  siteId: string
): Promise<boolean> {
  const pack = await prisma.pack.findFirst({ where: { id: packId, siteId } });
  if (!pack) return false;

  const existing = await prisma.packProduit.findFirst({
    where: { packId, produitId },
  });
  if (!existing) return false;

  await prisma.packProduit.delete({ where: { id: existing.id } });
  return true;
}

// ---------------------------------------------------------------------------
// PackActivation — queries lecture
// ---------------------------------------------------------------------------

/**
 * Recupere les activations du site vendeur avec filtres.
 */
export async function getPackActivations(
  siteId: string,
  filters?: PackActivationFilters
) {
  const where = {
    siteId,
    ...(filters?.statut && { statut: filters.statut as "ACTIVE" | "EXPIREE" | "SUSPENDUE" }),
    ...(filters?.packId && { packId: filters.packId }),
    ...(filters?.clientSiteId && { clientSiteId: filters.clientSiteId }),
  };

  return prisma.packActivation.findMany({
    where,
    include: {
      pack: { select: { id: true, nom: true, nombreAlevins: true, prixTotal: true } },
      user: { select: { id: true, name: true } },
      clientSite: { select: { id: true, name: true } },
      vagues: { select: { id: true, code: true, statut: true } },
    },
    orderBy: { dateActivation: "desc" },
  });
}

/**
 * Recupere une activation par ID.
 */
export async function getPackActivationById(id: string, siteId: string) {
  return prisma.packActivation.findFirst({
    where: { id, siteId },
    include: {
      pack: { select: { id: true, nom: true, nombreAlevins: true, prixTotal: true } },
      user: { select: { id: true, name: true } },
      clientSite: { select: { id: true, name: true } },
      vagues: { select: { id: true, code: true, statut: true, nombreInitial: true } },
    },
  });
}
