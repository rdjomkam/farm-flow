import { prisma } from "@/lib/db";
import { StatutActivation } from "@/types";
import type {
  CreatePackDTO,
  UpdatePackDTO,
  CreatePackProduitDTO,
  CreatePackBacDTO,
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
      bacs: { orderBy: { position: "asc" } },
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
      plan: { select: { id: true, nom: true } },
      bacs: { orderBy: { position: "asc" } },
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
      planId: data.planId,
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
      bacs: { orderBy: { position: "asc" } },
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

  // Guard: si nombreAlevins change, vérifier cohérence avec les bacs existants
  if (data.nombreAlevins !== undefined) {
    const bacs = await prisma.packBac.findMany({
      where: { packId: id },
      select: { nombreAlevins: true },
    });
    if (bacs.length > 0) {
      const bacsSum = bacs.reduce((acc, b) => acc + b.nombreAlevins, 0);
      if (data.nombreAlevins !== bacsSum) {
        throw new Error(
          `Le nombre d'alevins (${data.nombreAlevins}) doit correspondre a la somme des bacs (${bacsSum}).`
        );
      }
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
      ...(data.planId !== undefined && { planId: data.planId }),
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
      bacs: { orderBy: { position: "asc" } },
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
      unite: data.unite ?? null,
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
// PackBac — CRUD queries
// ---------------------------------------------------------------------------

/**
 * Recupere les bacs configures d'un Pack, tries par position.
 */
export async function getPackBacs(packId: string) {
  return prisma.packBac.findMany({
    where: { packId },
    orderBy: { position: "asc" },
  });
}

/**
 * Remplace tous les bacs d'un Pack en une seule transaction.
 * Invariant strict : sum(bacs.nombreAlevins) === pack.nombreAlevins
 */
export async function replacePackBacs(packId: string, bacs: CreatePackBacDTO[]) {
  const pack = await prisma.pack.findUnique({
    where: { id: packId },
    select: { nombreAlevins: true },
  });
  if (!pack) {
    throw new Error("Pack introuvable.");
  }

  // Validation des bacs individuels
  for (const bac of bacs) {
    if (!bac.nom || bac.nom.trim() === "") {
      throw new Error("Le nom du bac est requis.");
    }
    if (bac.nombreAlevins <= 0) {
      throw new Error("Le nombre d'alevins doit etre superieur a 0.");
    }
  }

  // Vérifier noms uniques
  const noms = bacs.map((b) => b.nom.trim().toLowerCase());
  const nomsSet = new Set(noms);
  if (nomsSet.size !== noms.length) {
    throw new Error("Les noms de bacs doivent etre uniques.");
  }

  // Invariant strict : somme === total pack
  const sum = bacs.reduce((acc, b) => acc + b.nombreAlevins, 0);
  if (sum !== pack.nombreAlevins) {
    throw new Error(
      `La somme des alevins (${sum}) doit correspondre au total du pack (${pack.nombreAlevins}).`
    );
  }

  // Transaction atomique : supprimer tous les anciens, créer les nouveaux
  return prisma.$transaction(async (tx) => {
    await tx.packBac.deleteMany({ where: { packId } });

    const created = await Promise.all(
      bacs.map((bac, index) =>
        tx.packBac.create({
          data: {
            packId,
            nom: bac.nom.trim(),
            volume: bac.volume ?? null,
            nombreAlevins: bac.nombreAlevins,
            poidsMoyenInitial: bac.poidsMoyenInitial ?? 5,
            position: bac.position ?? index,
          },
        })
      )
    );

    return created;
  });
}

/**
 * Valide que la somme des nombreAlevins des bacs configures correspond au total du Pack.
 */
export async function validatePackBacsTotal(
  packId: string
): Promise<{ valid: boolean; sum: number; expected: number }> {
  const pack = await prisma.pack.findUnique({
    where: { id: packId },
    select: { nombreAlevins: true },
  });
  if (!pack) {
    return { valid: false, sum: 0, expected: 0 };
  }

  const bacs = await prisma.packBac.findMany({ where: { packId } });
  const sum = bacs.reduce((acc, b) => acc + b.nombreAlevins, 0);

  return {
    valid: bacs.length === 0 || sum === pack.nombreAlevins,
    sum,
    expected: pack.nombreAlevins,
  };
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
