import { prisma } from "@/lib/db";
import { generateNextNumero } from "./numero-utils";
import {
  StatutBesoins,
  StatutCommande,
  CategorieDepense,
  CategorieProduit,
  TypeMouvement,
} from "@/types";
import type {
  CreateListeBesoinsDTO,
  UpdateListeBesoinsDTO,
  ListeBesoinsFilters,
  TraiterBesoinsDTO,
  CloturerBesoinsDTO,
  CreerCommandeDepuisBesoinDTO,
  VagueRatioDTO,
} from "@/types";
import { convertirQuantiteAchat } from "@/lib/calculs";

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

/**
 * Mappe une CategorieProduit vers la CategorieDepense correspondante.
 * CategorieProduit est un sous-ensemble strict de CategorieDepense (mêmes noms).
 * Les lignes sans produit reçoivent AUTRE.
 */
export function categorieProduitToDepense(
  categorie: CategorieProduit | null | undefined | string
): CategorieDepense {
  if (!categorie) return CategorieDepense.AUTRE;
  // Cast direct : ALIMENT, INTRANT, EQUIPEMENT ont le même nom dans les deux enums
  return categorie as unknown as CategorieDepense;
}

/**
 * Calcule la catégorie dominante parmi les lignes de dépense (ADR-027 section 2).
 * Critère : somme des montantTotal par catégorie.
 * En cas d'égalité : priorité selon l'ordre de PRIORITE (index plus bas = priorité plus haute).
 * Les catégories absentes du tableau reçoivent une priorité Infinity (la plus basse).
 */
export function computeDominantCategorie(
  lignes: Array<{ categorieDepense: CategorieDepense; montantTotal: number }>
): CategorieDepense {
  // Ordre complet de toutes les valeurs CategorieDepense : index plus bas = priorité plus haute
  const PRIORITE: CategorieDepense[] = [
    CategorieDepense.ALIMENT,
    CategorieDepense.INTRANT,
    CategorieDepense.EQUIPEMENT,
    CategorieDepense.SALAIRE,
    CategorieDepense.VETERINAIRE,
    CategorieDepense.TRANSPORT,
    CategorieDepense.ELECTRICITE,
    CategorieDepense.EAU,
    CategorieDepense.LOYER,
    CategorieDepense.REPARATION,
    CategorieDepense.INVESTISSEMENT,
    CategorieDepense.AUTRE,
  ];

  const totaux = new Map<CategorieDepense, number>();
  for (const l of lignes) {
    totaux.set(l.categorieDepense, (totaux.get(l.categorieDepense) ?? 0) + l.montantTotal);
  }

  if (totaux.size === 0) return CategorieDepense.AUTRE;

  let dominant: CategorieDepense = CategorieDepense.AUTRE;
  let maxMontant = -1;

  for (const [cat, montant] of totaux.entries()) {
    const estPlusGrand = montant > maxMontant;
    const indexCat = PRIORITE.indexOf(cat);
    const indexDominant = PRIORITE.indexOf(dominant);
    const prioriteCat = indexCat === -1 ? Infinity : indexCat;
    const prioriteDominant = indexDominant === -1 ? Infinity : indexDominant;
    const estEgalAvecPriorite =
      montant === maxMontant && prioriteCat < prioriteDominant;
    if (estPlusGrand || estEgalAvecPriorite) {
      dominant = cat;
      maxMontant = montant;
    }
  }

  return dominant;
}

// ---------------------------------------------------------------------------
// Validation des ratios vague (R-MV-02, R-MV-04)
// ---------------------------------------------------------------------------

/**
 * Valide que les ratios vague sont corrects :
 * - Chaque ratio doit etre > 0 et <= 1 (R-MV-04)
 * - Si au moins une vague, la somme doit etre = 1.0 +- 0.001 (R-MV-02)
 */
function validerRatios(vagues: VagueRatioDTO[]): void {
  if (vagues.length === 0) return;
  for (const v of vagues) {
    if (v.ratio <= 0 || v.ratio > 1) {
      throw new Error(`Ratio invalide ${v.ratio} pour la vague ${v.vagueId} (doit etre > 0 et <= 1)`);
    }
  }
  const somme = vagues.reduce((acc, v) => acc + v.ratio, 0);
  if (Math.abs(somme - 1.0) > 0.001) {
    throw new Error(
      `La somme des ratios doit etre egale a 1.0 (somme actuelle : ${somme.toFixed(3)})`
    );
  }
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
  vagues: {
    select: {
      id: true,
      vagueId: true,
      ratio: true,
      vague: { select: { id: true, code: true } },
    },
  },
  lignes: {
    include: {
      produit: { select: { id: true, nom: true, unite: true, fournisseurId: true } },
      commande: { select: { id: true, numero: true, statut: true } },
      lignesDepense: { select: { id: true } },
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

/** Liste les listes de besoins d'un site avec filtres et pagination */
export async function getListeBesoins(
  siteId: string,
  filters?: ListeBesoinsFilters,
  pagination?: { limit: number; offset: number }
) {
  const maintenant = new Date();

  // Build AND conditions to combine search OR with other clauses safely
  const andConditions: object[] = [];

  if (filters?.search) {
    const term = filters.search.trim();
    if (term) {
      andConditions.push({
        OR: [
          { numero: { contains: term, mode: "insensitive" } },
          { titre: { contains: term, mode: "insensitive" } },
        ],
      });
    }
  }

  const where: Record<string, unknown> = {
    siteId,
    ...(filters?.statut && {
      statut: Array.isArray(filters.statut) ? { in: filters.statut } : filters.statut,
    }),
    ...(filters?.demandeurId && {
      demandeurId: Array.isArray(filters.demandeurId) ? { in: filters.demandeurId } : filters.demandeurId,
    }),
    ...(filters?.valideurId && {
      valideurId: Array.isArray(filters.valideurId) ? { in: filters.valideurId } : filters.valideurId,
    }),
    ...(filters?.vagueId && {
      vagues: {
        some: {
          vagueId: Array.isArray(filters.vagueId) ? { in: filters.vagueId } : filters.vagueId,
        },
      },
    }),
    ...(filters?.dateFrom || filters?.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
            ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
          },
        }
      : {}),
    ...(filters?.dateLimiteFrom || filters?.dateLimiteTo
      ? {
          dateLimite: {
            ...(filters.dateLimiteFrom && { gte: new Date(filters.dateLimiteFrom) }),
            ...(filters.dateLimiteTo && { lte: new Date(filters.dateLimiteTo) }),
          },
        }
      : {}),
    ...(filters?.montantEstimeMin !== undefined || filters?.montantEstimeMax !== undefined
      ? {
          montantEstime: {
            ...(filters.montantEstimeMin !== undefined && { gte: filters.montantEstimeMin }),
            ...(filters.montantEstimeMax !== undefined && { lte: filters.montantEstimeMax }),
          },
        }
      : {}),
    ...(filters?.produitId && {
      lignes: {
        some: {
          produitId: Array.isArray(filters.produitId) ? { in: filters.produitId } : filters.produitId,
        },
      },
    }),
    ...(filters?.hasCommande === true && {
      lignes: { some: { commandeId: { not: null } } },
    }),
    // Filtre enRetard : dateLimite depassee et statut non terminal (ADR-017.2)
    ...(filters?.enRetard
      ? {
          dateLimite: { lt: maintenant, not: null },
          statut: { in: [StatutBesoins.SOUMISE, StatutBesoins.APPROUVEE] },
        }
      : {}),
  };

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.listeBesoins.findMany({
      where,
      include: {
        demandeur: { select: { id: true, name: true } },
        valideur: { select: { id: true, name: true } },
        vagues: {
          select: {
            id: true,
            vagueId: true,
            ratio: true,
            vague: { select: { id: true, code: true } },
          },
        },
        _count: { select: { lignes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.listeBesoins.count({ where }),
  ]);

  return { data, total };
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
  if (data.vagues && data.vagues.length > 0) {
    validerRatios(data.vagues);
  }
  const numero = await generateNumeroBesoin(siteId);
  const montantEstime = calculerMontantEstime(data.lignes);

  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.create({
      data: {
        numero,
        titre: data.titre,
        demandeurId: userId,
        montantEstime,
        notes: data.notes ?? null,
        dateLimite: data.dateLimite ? new Date(data.dateLimite) : null,
        siteId,
      },
    });

    // Creer les associations vague (table de jonction)
    if (data.vagues && data.vagues.length > 0) {
      await tx.listeBesoinsVague.createMany({
        data: data.vagues.map((v) => ({
          listeBesoinsId: liste.id,
          vagueId: v.vagueId,
          ratio: v.ratio,
          siteId,
        })),
      });
    }

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

    // Mise a jour des vagues (remplacement atomique si fourni)
    if (data.vagues !== undefined) {
      const nouvellesVagues = data.vagues ?? [];
      if (nouvellesVagues.length > 0) {
        validerRatios(nouvellesVagues);
      }
      // Supprimer toutes les associations existantes
      await tx.listeBesoinsVague.deleteMany({ where: { listeBesoinsId: id } });
      // Recréer si non null/vide
      if (nouvellesVagues.length > 0) {
        await tx.listeBesoinsVague.createMany({
          data: nouvellesVagues.map((v) => ({
            listeBesoinsId: id,
            vagueId: v.vagueId,
            ratio: v.ratio,
            siteId: liste.siteId,
          })),
        });
      }
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
        ...(data.notes !== undefined && { notes: data.notes }),
        // dateLimite : null = supprimer, string = mettre a jour, undefined = inchange (ADR-017.2)
        ...(data.dateLimite !== undefined && {
          dateLimite: data.dateLimite ? new Date(data.dateLimite) : null,
        }),
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

    await tx.listeBesoins.update({
      where: { id },
      data: {
        statut: StatutBesoins.APPROUVEE,
        valideurId,
      },
    });
    return tx.listeBesoins.findUniqueOrThrow({
      where: { id },
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

    await tx.listeBesoins.update({
      where: { id },
      data: {
        statut: StatutBesoins.REJETEE,
        valideurId,
        motifRejet: motif ?? null,
      },
    });
    return tx.listeBesoins.findUniqueOrThrow({
      where: { id },
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

    // Validation prealable : toute ligne COMMANDE doit avoir un fournisseur resolvable
    // (sur le produit ou via dto.fournisseurId en fallback). Plus de skip silencieux.
    const lignesCommandeSansFournisseur: string[] = [];
    for (const ligne of liste.lignes) {
      const action = actionsMap.get(ligne.id) ?? "LIBRE";
      if (action === "COMMANDE") {
        if (!ligne.produitId || !ligne.produit) {
          lignesCommandeSansFournisseur.push(ligne.designation);
          continue;
        }
        const fournisseurId =
          ligne.produit.fournisseur?.id ?? dto.fournisseurId ?? null;
        if (!fournisseurId) {
          lignesCommandeSansFournisseur.push(ligne.designation);
        }
      }
    }
    if (lignesCommandeSansFournisseur.length > 0) {
      throw new Error(
        `Action COMMANDE impossible sans fournisseur pour : ${lignesCommandeSansFournisseur.join(", ")}. Selectionnez un fournisseur ou choisissez Achat direct.`
      );
    }

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
        // La validation prealable garantit qu'un fournisseur est resolvable
        const fournisseurId =
          ligne.produit.fournisseur?.id ?? dto.fournisseurId ?? null;
        if (!fournisseurId) continue;
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

    // Année partagée pour la numérotation commandes et dépenses (évite deux appels new Date())
    const annee = new Date().getFullYear();

    // Generer le numero de commande
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

    // Map ligneBesoinId → ligneCommandeId, construit pendant la boucle de création (BUG-1)
    const ligneBesoinToLigneCommande = new Map<string, string>();

    // Creer une commande par groupe fournisseur
    for (const [fournisseurId, lignes] of groupesFournisseur.entries()) {
      const montantCmd = lignes.reduce(
        (s, l) => s + l.quantite * l.prixUnitaire,
        0
      );
      const numeroCmd = `CMD-${annee}-${String(seqCmd).padStart(3, "0")}`;
      seqCmd++;

      const commandeCreated = await tx.commande.create({
        data: {
          numero: numeroCmd,
          fournisseurId,
          statut: StatutCommande.BROUILLON,
          dateCommande: new Date(),
          montantTotal: montantCmd,
          userId,
          siteId,
          listeBesoinsId: liste.id,
          lignes: {
            create: lignes.map((l) => ({
              produitId: l.produitId,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
            })),
          },
        },
      });
      const commande = await tx.commande.findUniqueOrThrow({
        where: { id: commandeCreated.id },
        include: { lignes: { select: { id: true, produitId: true } } },
      });

      // Construire le mapping ligneBesoinId → ligneCommandeId
      // On récupère les lignes de commande créées dans le même ordre que les lignes du groupe
      for (let i = 0; i < lignes.length; i++) {
        const ligneCmd = commande.lignes[i];
        if (ligneCmd) {
          ligneBesoinToLigneCommande.set(lignes[i].ligneId, ligneCmd.id);
        }
      }

      // Lier commandeId sur chaque LigneBesoin
      await tx.ligneBesoin.updateMany({
        where: { id: { in: lignes.map((l) => l.ligneId) } },
        data: { commandeId: commande.id },
      });
    }

    // Creer la depense liee a la liste de besoins — UNIQUEMENT pour les lignes LIBRE
    // Les lignes COMMANDE auront leur depense creee lors de recevoirCommande()
    const lignesLibres = liste.lignes.filter((lb) => {
      const action = actionsMap.get(lb.id) ?? "LIBRE";
      return action === "LIBRE";
    });

    if (lignesLibres.length > 0) {
      const numeroDep = await generateNextNumero(tx, "depense", "DEP", siteId);

      // Construire les lignes de dépense depuis les LigneBesoin LIBRE uniquement (ADR-027)
      const lignesDepenseData = lignesLibres.map((lb) => {
        const prixUnitaire = lb.prixReel ?? lb.prixEstime;
        const montantLigne = lb.quantite * prixUnitaire;
        const cat = categorieProduitToDepense(lb.produit?.categorie);
        return {
          designation: lb.designation,
          categorieDepense: cat,
          quantite: lb.quantite,
          prixUnitaire,
          montantTotal: montantLigne,
          produitId: lb.produitId ?? null,
          ligneBesoinId: lb.id,
          ligneCommandeId: ligneBesoinToLigneCommande.get(lb.id) ?? null,
          siteId,
        };
      });

      // Montant total = somme des lignes LIBRE uniquement
      const montantTotalDepense = lignesDepenseData.reduce(
        (acc, l) => acc + l.montantTotal,
        0
      );

      // Catégorie dominante par montant
      const categorieDepense = computeDominantCategorie(lignesDepenseData);

      const depense = await tx.depense.create({
        data: {
          numero: numeroDep,
          description: `Depense — ${liste.titre}`,
          categorieDepense,
          montantTotal: montantTotalDepense,
          date: new Date(),
          listeBesoinsId: liste.id,
          userId,
          siteId,
        },
      });

      // Créer les LigneDepense dans la même transaction (R4 — atomique)
      await tx.ligneDepense.createMany({
        data: lignesDepenseData.map((l) => ({
          depenseId: depense.id,
          designation: l.designation,
          categorieDepense: l.categorieDepense,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          montantTotal: l.montantTotal,
          produitId: l.produitId,
          ligneBesoinId: l.ligneBesoinId,
          ligneCommandeId: l.ligneCommandeId,
          siteId,
        })),
      });
    }

    // Pour les lignes LIBRE referencant un produit suivi en stock,
    // creer un MouvementStock ENTREE et incrementer Produit.stockActuel.
    // Un achat direct introduit physiquement les biens dans le site → le stock doit refleter cela.
    for (const lb of liste.lignes) {
      const action = actionsMap.get(lb.id) ?? "LIBRE";
      if (action !== "LIBRE" || !lb.produitId || !lb.produit) continue;

      const prixUnitaire = lb.prixReel ?? lb.prixEstime;
      const quantiteBase = convertirQuantiteAchat(lb.quantite, lb.produit);
      await tx.mouvementStock.create({
        data: {
          produitId: lb.produitId,
          type: TypeMouvement.ENTREE,
          quantite: lb.quantite,
          prixTotal: lb.quantite * prixUnitaire,
          userId,
          date: new Date(),
          notes: `Achat direct ${liste.numero}`,
          siteId,
        },
      });
      await tx.produit.update({
        where: { id: lb.produitId },
        data: { stockActuel: { increment: quantiteBase } },
      });
    }

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
 * Cree une ou plusieurs Commande BROUILLON pour des lignes de besoin orphelines
 * (commandeId IS NULL) sur une ListeBesoins TRAITEE ou CLOTUREE.
 *
 * Use case : recuperer un besoin clos dont certaines lignes n'ont jamais ete
 * commandees (oubli, fournisseur initialement manquant, etc.).
 *
 * - Lignes ciblees : doivent appartenir au besoin, avoir produitId != null, commandeId == null.
 * - Groupement par fournisseur (du produit ou dto.fournisseurId en fallback).
 * - Aucune modification du statut de la ListeBesoins.
 * - Si une LigneDepense existe deja pour la ligne (LIBRE precedent), elle est rattachee
 *   a la nouvelle LigneCommande pour qu'a la reception, recevoirCommande ne re-cree
 *   pas une depense en double.
 */
export async function creerCommandeDepuisBesoin(
  id: string,
  siteId: string,
  userId: string,
  dto: CreerCommandeDepuisBesoinDTO
) {
  const hasCommande = Array.isArray(dto.ligneBesoinIds) && dto.ligneBesoinIds.length > 0;
  const hasDepense = Array.isArray(dto.lignesDepense) && dto.lignesDepense.length > 0;
  if (!hasCommande && !hasDepense) {
    throw new Error("Au moins une ligne doit etre selectionnee.");
  }

  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.findFirst({
      where: { id, siteId },
      include: {
        lignes: {
          include: {
            produit: {
              include: { fournisseur: { select: { id: true } } },
            },
            lignesDepense: { select: { id: true } },
          },
        },
        depenses: { select: { id: true, montantTotal: true } },
      },
    });
    if (!liste) throw new Error("Liste de besoins introuvable");
    if (
      liste.statut !== StatutBesoins.TRAITEE &&
      liste.statut !== StatutBesoins.CLOTUREE
    ) {
      throw new Error(
        `Le traitement post-traitement n'est possible que pour les besoins TRAITEE ou CLOTUREE (statut actuel : ${liste.statut}).`
      );
    }

    const lignesMap = new Map(liste.lignes.map((l) => [l.id, l]));

    // --- Partie COMMANDE ---
    const ciblesCommande: typeof liste.lignes = [];
    for (const ligneId of dto.ligneBesoinIds ?? []) {
      const ligne = lignesMap.get(ligneId);
      if (!ligne) {
        throw new Error(`Ligne ${ligneId} introuvable dans le besoin ${liste.numero}.`);
      }
      if (!ligne.produitId || !ligne.produit) {
        throw new Error(
          `La ligne « ${ligne.designation} » n'a pas de produit lie : impossible de creer une commande.`
        );
      }
      if (ligne.commandeId) {
        throw new Error(
          `La ligne « ${ligne.designation} » est deja liee a une commande.`
        );
      }
      ciblesCommande.push(ligne);
    }

    // Verifier fournisseur uniquement sur les lignes COMMANDE
    const sansFournisseur: string[] = [];
    for (const ligne of ciblesCommande) {
      const fournisseurId =
        ligne.produit?.fournisseur?.id ?? dto.fournisseurId ?? null;
      if (!fournisseurId) sansFournisseur.push(ligne.designation);
    }
    if (sansFournisseur.length > 0) {
      throw new Error(
        `Aucun fournisseur n'est defini pour : ${sansFournisseur.join(", ")}. Selectionnez un fournisseur.`
      );
    }

    // --- Partie DEPENSE DIRECTE ---
    const ciblesDepense: typeof liste.lignes = [];
    for (const ligneId of dto.lignesDepense ?? []) {
      const ligne = lignesMap.get(ligneId);
      if (!ligne) {
        throw new Error(`Ligne ${ligneId} introuvable dans le besoin ${liste.numero}.`);
      }
      // Skip si deja traitee en depense
      if (ligne.lignesDepense && ligne.lignesDepense.length > 0) continue;
      if (!ligne.produitId || !ligne.produit) continue;
      ciblesDepense.push(ligne);
    }

    // --- Creer les commandes ---
    if (ciblesCommande.length > 0) {
      const groupes = new Map<string, typeof ciblesCommande>();
      for (const ligne of ciblesCommande) {
        const fournisseurId =
          ligne.produit!.fournisseur?.id ?? dto.fournisseurId!;
        if (!groupes.has(fournisseurId)) groupes.set(fournisseurId, []);
        groupes.get(fournisseurId)!.push(ligne);
      }

      const dateCommande = dto.dateCommande ? new Date(dto.dateCommande) : new Date();
      const annee = dateCommande.getFullYear();

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

      for (const [fournisseurId, lignes] of groupes.entries()) {
        const montantCmd = lignes.reduce(
          (s, l) => s + l.quantite * (l.prixReel ?? l.prixEstime),
          0
        );
        const numeroCmd = `CMD-${annee}-${String(seqCmd).padStart(3, "0")}`;
        seqCmd++;

        const commandeCreated2 = await tx.commande.create({
          data: {
            numero: numeroCmd,
            fournisseurId,
            statut: StatutCommande.BROUILLON,
            dateCommande,
            montantTotal: montantCmd,
            userId,
            siteId,
            listeBesoinsId: liste.id,
            lignes: {
              create: lignes.map((l) => ({
                produitId: l.produitId!,
                quantite: l.quantite,
                prixUnitaire: l.prixReel ?? l.prixEstime,
              })),
            },
          },
        });
        const commande = await tx.commande.findUniqueOrThrow({
          where: { id: commandeCreated2.id },
          include: { lignes: { select: { id: true, produitId: true } } },
        });

        for (let i = 0; i < lignes.length; i++) {
          const ligneBesoin = lignes[i];
          const ligneCmd = commande.lignes[i];
          if (!ligneCmd) continue;

          await tx.ligneBesoin.update({
            where: { id: ligneBesoin.id },
            data: { commandeId: commande.id },
          });

          if (ligneBesoin.lignesDepense && ligneBesoin.lignesDepense.length > 0) {
            await tx.ligneDepense.updateMany({
              where: { ligneBesoinId: ligneBesoin.id },
              data: { ligneCommandeId: ligneCmd.id },
            });
          }
        }
      }
    }

    // --- Creer les depenses directes ---
    if (ciblesDepense.length > 0) {
      const lignesDepenseData = ciblesDepense.map((lb) => {
        const prixUnitaire = lb.prixReel ?? lb.prixEstime;
        const montantLigne = lb.quantite * prixUnitaire;
        const cat = categorieProduitToDepense(lb.produit?.categorie);
        return {
          designation: lb.designation,
          categorieDepense: cat,
          quantite: lb.quantite,
          prixUnitaire,
          montantTotal: montantLigne,
          produitId: lb.produitId ?? null,
          ligneBesoinId: lb.id,
          siteId,
        };
      });

      const montantTotalDepense = lignesDepenseData.reduce(
        (acc, l) => acc + l.montantTotal,
        0
      );

      // Reutiliser la depense existante de la liste si presente
      const depenseExistante = liste.depenses[0] ?? null;

      let depenseId: string;
      if (depenseExistante) {
        await tx.depense.update({
          where: { id: depenseExistante.id },
          data: {
            montantTotal: { increment: montantTotalDepense },
          },
        });
        depenseId = depenseExistante.id;
      } else {
        const numeroDep = await generateNextNumero(tx, "depense", "DEP", siteId);
        const categorieDepense = computeDominantCategorie(lignesDepenseData);
        const depense = await tx.depense.create({
          data: {
            numero: numeroDep,
            description: `Depense directe — ${liste.titre}`,
            categorieDepense,
            montantTotal: montantTotalDepense,
            date: new Date(),
            listeBesoinsId: liste.id,
            userId,
            siteId,
          },
        });
        depenseId = depense.id;
      }

      await tx.ligneDepense.createMany({
        data: lignesDepenseData.map((l) => ({
          depenseId,
          designation: l.designation,
          categorieDepense: l.categorieDepense,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          montantTotal: l.montantTotal,
          produitId: l.produitId,
          ligneBesoinId: l.ligneBesoinId,
          siteId,
        })),
      });

      // Creer les mouvements de stock ENTREE pour chaque ligne depense directe
      for (const lb of ciblesDepense) {
        if (!lb.produitId || !lb.produit) continue;
        const prixUnitaire = lb.prixReel ?? lb.prixEstime;
        const quantiteBase = convertirQuantiteAchat(lb.quantite, lb.produit);
        await tx.mouvementStock.create({
          data: {
            produitId: lb.produitId,
            type: TypeMouvement.ENTREE,
            quantite: lb.quantite,
            prixTotal: lb.quantite * prixUnitaire,
            userId,
            date: new Date(),
            notes: `Depense directe ${liste.numero}`,
            siteId,
          },
        });
        await tx.produit.update({
          where: { id: lb.produitId },
          data: { stockActuel: { increment: quantiteBase } },
        });
      }
    }

    return tx.listeBesoins.findUniqueOrThrow({
      where: { id },
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
