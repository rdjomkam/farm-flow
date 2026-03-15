import { prisma } from "@/lib/db";
import { StatutBesoins, StatutCommande } from "@/types";
import type {
  CreateListeBesoinsDTO,
  UpdateListeBesoinsDTO,
  ListeBesoinsFilters,
  TraiterBesoinsDTO,
  CloturerBesoinsDTO,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Genere le numero auto BES-YYYY-NNN pour une liste de besoins */
async function generateNumeroBesoin(siteId: string): Promise<string> {
  const annee = new Date().getFullYear();
  const prefixe = `BES-${annee}-`;
  const derniere = await prisma.listeBesoins.findFirst({
    where: { siteId, numero: { startsWith: prefixe } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  let seq = 1;
  if (derniere) {
    const partie = derniere.numero.split("-")[2];
    seq = (parseInt(partie, 10) || 0) + 1;
  }
  return `${prefixe}${String(seq).padStart(3, "0")}`;
}

/** Calcule le montantEstime d'une liste (SUM quantite * prixEstime) */
function calculerMontantEstime(
  lignes: Array<{ quantite: number; prixEstime: number }>
): number {
  return lignes.reduce((acc, l) => acc + l.quantite * l.prixEstime, 0);
}

// ---------------------------------------------------------------------------
// Transitions valides
// ---------------------------------------------------------------------------

const TRANSITIONS_VALIDES: Record<StatutBesoins, StatutBesoins[]> = {
  [StatutBesoins.SOUMISE]: [StatutBesoins.APPROUVEE, StatutBesoins.REJETEE],
  [StatutBesoins.APPROUVEE]: [StatutBesoins.TRAITEE],
  [StatutBesoins.TRAITEE]: [StatutBesoins.CLOTUREE],
  [StatutBesoins.CLOTUREE]: [],
  [StatutBesoins.REJETEE]: [],
};

function verifierTransition(
  statutActuel: string,
  statutCible: StatutBesoins
): void {
  const transitions = TRANSITIONS_VALIDES[statutActuel as StatutBesoins];
  if (!transitions || !transitions.includes(statutCible)) {
    throw new Error(
      `Transition invalide : ${statutActuel} → ${statutCible}`
    );
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Inclure toutes les relations courantes d'une liste de besoins */
const INCLUDE_LISTE_BESOINS = {
  demandeur: { select: { id: true, name: true } },
  valideur: { select: { id: true, name: true } },
  vague: { select: { id: true, code: true } },
  lignes: {
    include: {
      produit: { select: { id: true, nom: true, unite: true } },
      commande: { select: { id: true, numero: true, statut: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  depenses: {
    select: {
      id: true,
      numero: true,
      montantTotal: true,
      statut: true,
    },
  },
  _count: { select: { lignes: true } },
};

/** Liste les listes de besoins d'un site avec filtres */
export async function getListeBesoins(
  siteId: string,
  filters?: ListeBesoinsFilters
) {
  return prisma.listeBesoins.findMany({
    where: {
      siteId,
      ...(filters?.statut && { statut: filters.statut }),
      ...(filters?.demandeurId && { demandeurId: filters.demandeurId }),
      ...(filters?.vagueId && { vagueId: filters.vagueId }),
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
              ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
            },
          }
        : {}),
    },
    include: {
      demandeur: { select: { id: true, name: true } },
      valideur: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
      _count: { select: { lignes: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Recupere une liste de besoins par ID avec toutes ses relations */
export async function getListeBesoinsById(id: string, siteId: string) {
  return prisma.listeBesoins.findFirst({
    where: { id, siteId },
    include: INCLUDE_LISTE_BESOINS,
  });
}

/**
 * Cree une liste de besoins avec ses lignes.
 * - Numero auto BES-YYYY-NNN
 * - montantEstime calcule automatiquement
 */
export async function createListeBesoins(
  siteId: string,
  userId: string,
  data: CreateListeBesoinsDTO
) {
  if (!data.lignes || data.lignes.length === 0) {
    throw new Error("La liste doit contenir au moins une ligne de besoin");
  }
  const numero = await generateNumeroBesoin(siteId);
  const montantEstime = calculerMontantEstime(data.lignes);

  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.create({
      data: {
        numero,
        titre: data.titre,
        demandeurId: userId,
        vagueId: data.vagueId ?? null,
        montantEstime,
        notes: data.notes ?? null,
        siteId,
      },
    });

    // Creer les lignes
    await tx.ligneBesoin.createMany({
      data: data.lignes.map((l) => ({
        listeBesoinsId: liste.id,
        designation: l.designation,
        produitId: l.produitId ?? null,
        quantite: l.quantite,
        unite: l.unite ?? null,
        prixEstime: l.prixEstime,
      })),
    });

    return tx.listeBesoins.findUniqueOrThrow({
      where: { id: liste.id },
      include: INCLUDE_LISTE_BESOINS,
    });
  });
}

/**
 * Met a jour une liste de besoins (seulement si statut SOUMISE).
 * Si lignes est fourni, on remplace toutes les lignes existantes.
 */
export async function updateListeBesoins(
  id: string,
  siteId: string,
  data: UpdateListeBesoinsDTO
) {
  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.findFirst({ where: { id, siteId } });
    if (!liste) throw new Error("Liste de besoins introuvable");
    if (liste.statut !== StatutBesoins.SOUMISE) {
      throw new Error(
        "Impossible de modifier une liste qui n'est plus SOUMISE"
      );
    }

    // Si nouvelles lignes fournies, recalcul montantEstime
    let montantEstime = liste.montantEstime;
    if (data.lignes) {
      // Supprimer les anciennes lignes
      await tx.ligneBesoin.deleteMany({ where: { listeBesoinsId: id } });
      // Creer les nouvelles
      await tx.ligneBesoin.createMany({
        data: data.lignes.map((l) => ({
          listeBesoinsId: id,
          designation: l.designation,
          produitId: l.produitId ?? null,
          quantite: l.quantite,
          unite: l.unite ?? null,
          prixEstime: l.prixEstime,
        })),
      });
      montantEstime = calculerMontantEstime(data.lignes);
    }

    return tx.listeBesoins.update({
      where: { id },
      data: {
        ...(data.titre !== undefined && { titre: data.titre }),
        ...(data.vagueId !== undefined && { vagueId: data.vagueId }),
        ...(data.notes !== undefined && { notes: data.notes }),
        montantEstime,
      },
      include: INCLUDE_LISTE_BESOINS,
    });
  });
}

/**
 * Approuve une liste de besoins (SOUMISE → APPROUVEE).
 */
export async function approuverBesoins(
  id: string,
  siteId: string,
  valideurId: string
) {
  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.findFirst({ where: { id, siteId } });
    if (!liste) throw new Error("Liste de besoins introuvable");
    verifierTransition(liste.statut, StatutBesoins.APPROUVEE);

    return tx.listeBesoins.update({
      where: { id },
      data: {
        statut: StatutBesoins.APPROUVEE,
        valideurId,
      },
      include: INCLUDE_LISTE_BESOINS,
    });
  });
}

/**
 * Rejette une liste de besoins (SOUMISE → REJETEE).
 */
export async function rejeterBesoins(
  id: string,
  siteId: string,
  valideurId: string,
  motif?: string
) {
  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.findFirst({ where: { id, siteId } });
    if (!liste) throw new Error("Liste de besoins introuvable");
    verifierTransition(liste.statut, StatutBesoins.REJETEE);

    return tx.listeBesoins.update({
      where: { id },
      data: {
        statut: StatutBesoins.REJETEE,
        valideurId,
        motifRejet: motif ?? null,
      },
      include: INCLUDE_LISTE_BESOINS,
    });
  });
}

/**
 * Traite une liste de besoins (APPROUVEE → TRAITEE).
 *
 * Pour chaque ligne avec action COMMANDE et produitId :
 *   - Groupe les lignes par fournisseur du produit
 *   - Cree une Commande BROUILLON par groupe fournisseur
 *   - Lie le commandeId sur la LigneBesoin
 *
 * Cree une Depense liee a la liste (montantEstime, type AUTRE si mixte).
 */
export async function traiterBesoins(
  id: string,
  siteId: string,
  userId: string,
  dto: TraiterBesoinsDTO
) {
  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.findFirst({
      where: { id, siteId },
      include: {
        lignes: {
          include: {
            produit: {
              include: { fournisseur: { select: { id: true } } },
            },
          },
        },
      },
    });
    if (!liste) throw new Error("Liste de besoins introuvable");
    verifierTransition(liste.statut, StatutBesoins.TRAITEE);

    // Map actions par ligneBesoinId
    const actionsMap = new Map(
      dto.ligneActions.map((a) => [a.ligneBesoinId, a.action])
    );

    // Grouper les lignes COMMANDE par fournisseurId
    const groupesFournisseur = new Map<
      string,
      Array<{
        ligneId: string;
        produitId: string;
        quantite: number;
        prixUnitaire: number;
      }>
    >();

    for (const ligne of liste.lignes) {
      const action = actionsMap.get(ligne.id) ?? "LIBRE";
      if (action === "COMMANDE" && ligne.produitId && ligne.produit) {
        const fournisseurId =
          ligne.produit.fournisseur?.id ?? dto.fournisseurId ?? "INCONNU";
        if (!groupesFournisseur.has(fournisseurId)) {
          groupesFournisseur.set(fournisseurId, []);
        }
        groupesFournisseur.get(fournisseurId)!.push({
          ligneId: ligne.id,
          produitId: ligne.produitId,
          quantite: ligne.quantite,
          prixUnitaire: ligne.prixEstime,
        });
      }
    }

    // Generer le numero de commande
    const annee = new Date().getFullYear();
    const dernierCmd = await tx.commande.findFirst({
      where: { siteId, numero: { startsWith: `CMD-${annee}-` } },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    let seqCmd = 1;
    if (dernierCmd) {
      const p = dernierCmd.numero.split("-")[2];
      seqCmd = (parseInt(p, 10) || 0) + 1;
    }

    // Creer une commande par groupe fournisseur
    const commandesCreees: string[] = [];
    for (const [fournisseurId, lignes] of groupesFournisseur.entries()) {
      if (fournisseurId === "INCONNU") continue;

      const montantCmd = lignes.reduce(
        (s, l) => s + l.quantite * l.prixUnitaire,
        0
      );
      const numeroCmd = `CMD-${annee}-${String(seqCmd).padStart(3, "0")}`;
      seqCmd++;

      const commande = await tx.commande.create({
        data: {
          numero: numeroCmd,
          fournisseurId,
          statut: StatutCommande.BROUILLON,
          dateCommande: new Date(),
          montantTotal: montantCmd,
          userId,
          siteId,
          lignes: {
            create: lignes.map((l) => ({
              produitId: l.produitId,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
            })),
          },
        },
      });
      commandesCreees.push(commande.id);

      // Lier commandeId sur chaque LigneBesoin
      await tx.ligneBesoin.updateMany({
        where: { id: { in: lignes.map((l) => l.ligneId) } },
        data: { commandeId: commande.id },
      });
    }

    // Creer la depense liee a la liste de besoins
    const anneeD = new Date().getFullYear();
    const dernierDep = await tx.depense.findFirst({
      where: { siteId, numero: { startsWith: `DEP-${anneeD}-` } },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    let seqDep = 1;
    if (dernierDep) {
      const p = dernierDep.numero.split("-")[2];
      seqDep = (parseInt(p, 10) || 0) + 1;
    }
    const numeroDep = `DEP-${anneeD}-${String(seqDep).padStart(3, "0")}`;

    await tx.depense.create({
      data: {
        numero: numeroDep,
        description: `Depense — ${liste.titre}`,
        categorieDepense: "AUTRE",
        montantTotal: liste.montantEstime,
        date: new Date(),
        listeBesoinsId: liste.id,
        userId,
        siteId,
      },
    });

    // Mettre a jour le statut de la liste
    return tx.listeBesoins.update({
      where: { id },
      data: { statut: StatutBesoins.TRAITEE },
      include: INCLUDE_LISTE_BESOINS,
    });
  });
}

/**
 * Cloture une liste de besoins (TRAITEE → CLOTUREE).
 * Met a jour les prixReel sur chaque ligne et calcule montantReel.
 */
export async function cloturerBesoins(
  id: string,
  siteId: string,
  dto: CloturerBesoinsDTO
) {
  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.findFirst({
      where: { id, siteId },
      include: { lignes: true },
    });
    if (!liste) throw new Error("Liste de besoins introuvable");
    verifierTransition(liste.statut, StatutBesoins.CLOTUREE);

    // Mettre a jour le prixReel sur chaque ligne
    for (const lr of dto.lignesReelles) {
      await tx.ligneBesoin.updateMany({
        where: { id: lr.ligneBesoinId, listeBesoinsId: id },
        data: { prixReel: lr.prixReel },
      });
    }

    // Calculer montantReel avec les nouvelles valeurs
    const lignesMaj = await tx.ligneBesoin.findMany({
      where: { listeBesoinsId: id },
    });
    const montantReel = lignesMaj.reduce(
      (acc, l) => acc + l.quantite * (l.prixReel ?? l.prixEstime),
      0
    );

    return tx.listeBesoins.update({
      where: { id },
      data: {
        statut: StatutBesoins.CLOTUREE,
        montantReel,
      },
      include: INCLUDE_LISTE_BESOINS,
    });
  });
}

/**
 * Supprime une liste de besoins (seulement si statut SOUMISE).
 * La suppression cascade sur LigneBesoin.
 */
export async function deleteListeBesoins(id: string, siteId: string) {
  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.findFirst({ where: { id, siteId } });
    if (!liste) throw new Error("Liste de besoins introuvable");
    if (liste.statut !== StatutBesoins.SOUMISE) {
      throw new Error(
        "Impossible de supprimer une liste qui n'est plus SOUMISE"
      );
    }
    return tx.listeBesoins.delete({ where: { id } });
  });
}
