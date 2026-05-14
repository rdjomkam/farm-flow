import { prisma } from "@/lib/db";
import { generateNextNumero } from "./numero-utils";
import {
  CategorieDepense,
  CategorieProduit,
  StatutCommande,
  TypeMouvement,
} from "@/types";
import type { CreateCommandeDTO, CommandeFilters } from "@/types";
import { convertirQuantiteAchat } from "@/lib/calculs";

/**
 * Derive la CategorieDepense depuis la CategorieProduit dominante d'une commande.
 * Utilisee lors de l'auto-creation de la depense a la reception.
 */
function categorieDepenseFromProduit(
  categorie: CategorieProduit
): CategorieDepense {
  switch (categorie) {
    case CategorieProduit.ALIMENT:
      return CategorieDepense.ALIMENT;
    case CategorieProduit.INTRANT:
      return CategorieDepense.INTRANT;
    case CategorieProduit.EQUIPEMENT:
      return CategorieDepense.EQUIPEMENT;
    default:
      return CategorieDepense.AUTRE;
  }
}

/** Liste les commandes d'un site avec filtres et pagination */
export async function getCommandes(
  siteId: string,
  filters?: CommandeFilters,
  pagination?: { limit: number; offset: number }
) {
  const where = {
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
  };

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.commande.findMany({
      where,
      include: {
        fournisseur: { select: { id: true, nom: true } },
        user: { select: { id: true, name: true } },
        _count: { select: { lignes: true } },
      },
      orderBy: { dateCommande: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.commande.count({ where }),
  ]);

  return { data, total };
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
          produit: { select: { id: true, nom: true, unite: true, uniteAchat: true, contenance: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      listeBesoins: { select: { id: true, numero: true, titre: true } },
      depenses: {
        select: { id: true, numero: true, montantTotal: true, date: true },
        orderBy: { date: "desc" },
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

    // Generate numero CMD-YYYY-NNN (findFirst+orderBy to avoid race condition)
    const numero = await generateNextNumero(tx, "commande", "CMD", siteId);

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
 * 2. Valide les lignesRecues si fournies (tous les ligneId doivent appartenir a la commande)
 * 3. Cree un mouvement ENTREE pour chaque ligne avec quantiteRecue > 0
 * 4. Met a jour le stockActuel de chaque produit
 * 5. Met a jour quantiteRecue sur chaque LigneCommande
 * 6. Change le statut en LIVREE + date de livraison + montantRecu
 * 7. Auto-cree une Depense base sur montantRecu
 *
 * Si lignesRecues absent, fallback vers quantite commandee (retro-compat).
 */
export async function recevoirCommande(
  id: string,
  siteId: string,
  userId: string,
  dateLivraison?: string,
  lignesRecues?: { ligneId: string; quantiteRecue: number }[]
) {
  return prisma.$transaction(async (tx) => {
    // Get commande with lignes + product conversion info + product categorie
    const commande = await tx.commande.findFirst({
      where: { id, siteId },
      select: {
        id: true,
        numero: true,
        fournisseurId: true,
        statut: true,
        dateCommande: true,
        dateLivraison: true,
        montantTotal: true,
        montantRecu: true,
        userId: true,
        siteId: true,
        listeBesoinsId: true,
        lignes: {
          include: {
            produit: {
              select: {
                uniteAchat: true,
                contenance: true,
                categorie: true,
                nom: true,
              },
            },
          },
        },
      },
    });

    if (!commande) throw new Error("Commande introuvable");

    if (
      commande.statut !== StatutCommande.ENVOYEE &&
      commande.statut !== StatutCommande.LIVREE_PARTIELLEMENT
    ) {
      throw new Error(
        `Impossible de recevoir une commande avec le statut ${commande.statut}. La commande doit etre en statut ENVOYEE ou LIVREE_PARTIELLEMENT.`
      );
    }

    const livraisonDate = dateLivraison ? new Date(dateLivraison) : new Date();
    const avertissements: string[] = [];

    // Build quantiteRecue map per ligneId
    let ligneMap: Map<string, number>;

    if (lignesRecues && lignesRecues.length > 0) {
      // Validate that all provided ligneIds belong to this commande
      const commandeLigneIds = new Set(commande.lignes.map((l) => l.id));
      for (const lr of lignesRecues) {
        if (!commandeLigneIds.has(lr.ligneId)) {
          throw new Error(
            `La ligne ${lr.ligneId} n'appartient pas a cette commande.`
          );
        }
        if (lr.quantiteRecue < 0) {
          throw new Error(
            `La quantite recue ne peut pas etre negative (ligne ${lr.ligneId}).`
          );
        }
      }

      // Lines not provided default to 0 (partial reception)
      ligneMap = new Map(commande.lignes.map((l) => [l.id, 0]));
      for (const lr of lignesRecues) {
        ligneMap.set(lr.ligneId, lr.quantiteRecue);
      }
    } else {
      // Fallback: use quantite commandee
      ligneMap = new Map(commande.lignes.map((l) => [l.id, l.quantite]));
    }

    // Detect surlivraisons (cumul deja recu + cette reception)
    for (const ligne of commande.lignes) {
      const qCetteReception = ligneMap.get(ligne.id) ?? 0;
      const dejaRecu = ligne.quantiteRecue ?? 0;
      const cumulTotal = dejaRecu + qCetteReception;
      if (cumulTotal > ligne.quantite) {
        avertissements.push(
          `${ligne.produit.nom} : surlivraison detectee (commande: ${ligne.quantite}, deja recu: ${dejaRecu}, cette reception: ${qCetteReception}, cumul: ${cumulTotal}).`
        );
      }
    }

    // Create ENTREE mouvement for each ligne with quantiteRecue > 0 + update stock
    let montantCetteReception = 0;

    for (const ligne of commande.lignes) {
      const qCetteReception = ligneMap.get(ligne.id) ?? 0;

      if (qCetteReception > 0) {
        const quantiteBase = convertirQuantiteAchat(qCetteReception, ligne.produit);

        await tx.mouvementStock.create({
          data: {
            produitId: ligne.produitId,
            type: TypeMouvement.ENTREE,
            quantite: qCetteReception,
            prixTotal: qCetteReception * ligne.prixUnitaire,
            commandeId: commande.id,
            userId,
            date: livraisonDate,
            notes: `Reception commande ${commande.numero}`,
            siteId,
          },
        });

        await tx.produit.update({
          where: { id: ligne.produitId },
          data: { stockActuel: { increment: quantiteBase } },
        });

        montantCetteReception += qCetteReception * ligne.prixUnitaire;
      }

      // Increment quantiteRecue (cumulative across receptions)
      const nouveauCumul = (ligne.quantiteRecue ?? 0) + qCetteReception;
      await tx.ligneCommande.update({
        where: { id: ligne.id },
        data: { quantiteRecue: nouveauCumul },
      });
    }

    // Calculate cumulative montantRecu
    const montantRecuCumul = (commande.montantRecu ?? 0) + montantCetteReception;

    // Determine new status: LIVREE if all lines fully received, else LIVREE_PARTIELLEMENT
    const toutesLignesCompletes = commande.lignes.every((ligne) => {
      const qCetteReception = ligneMap.get(ligne.id) ?? 0;
      const cumulTotal = (ligne.quantiteRecue ?? 0) + qCetteReception;
      return cumulTotal >= ligne.quantite;
    });

    const nouveauStatut = toutesLignesCompletes
      ? StatutCommande.LIVREE
      : StatutCommande.LIVREE_PARTIELLEMENT;

    const commandeMiseAJour = await tx.commande.update({
      where: { id: commande.id },
      data: {
        statut: nouveauStatut,
        dateLivraison: livraisonDate,
        montantRecu: montantRecuCumul,
      },
      include: {
        fournisseur: { select: { id: true, nom: true } },
        lignes: {
          include: { produit: { select: { id: true, nom: true, unite: true } } },
        },
      },
    });

    // Auto-create Depense for this reception (one per reception, not per commande).
    //
    // Anti-double-comptage : si toutes les lignes de la commande sont deja couvertes
    // par une LigneDepense pre-existante (ex. ligne traitee LIBRE puis recuperee
    // via creerCommandeDepuisBesoin), on ne cree pas de Depense.
    const ligneIds = commande.lignes.map((l) => l.id);
    const lignesDejaComptabilisees = await tx.ligneDepense.findMany({
      where: { ligneCommandeId: { in: ligneIds } },
      select: { ligneCommandeId: true },
    });
    const idsCouverts = new Set(
      lignesDejaComptabilisees.map((l) => l.ligneCommandeId)
    );
    const toutesLignesDejaBookees =
      ligneIds.length > 0 && ligneIds.every((id) => idsCouverts.has(id));

    let depense = null as { id: string; numero: string; montantTotal: number } | null;
    if (
      !toutesLignesDejaBookees &&
      montantCetteReception > 0
    ) {
      const categoriesDominantes = commande.lignes.reduce(
        (acc, ligne) => {
          const qCetteReception = ligneMap.get(ligne.id) ?? 0;
          if (qCetteReception <= 0) return acc;
          const cat = ligne.produit.categorie;
          acc[cat] = (acc[cat] ?? 0) + qCetteReception * ligne.prixUnitaire;
          return acc;
        },
        {} as Record<string, number>
      );
      const categorieDominante = (
        Object.entries(categoriesDominantes).sort(([, a], [, b]) => b - a)[0]?.[0] ?? CategorieProduit.ALIMENT
      ) as CategorieProduit;

      const depNumero = await generateNextNumero(tx, "depense", "DEP", siteId);

      depense = await tx.depense.create({
        data: {
          numero: depNumero,
          description: `Commande ${commande.numero} — reception`,
          categorieDepense: categorieDepenseFromProduit(categorieDominante),
          montantTotal: montantCetteReception,
          date: livraisonDate,
          commandeId: commande.id,
          listeBesoinsId: commande.listeBesoinsId ?? undefined,
          userId,
          siteId,
        },
      });

      const lignesDepenseData = commande.lignes
        .filter((l) => (ligneMap.get(l.id) ?? 0) > 0)
        .map((l) => {
          const qCetteReception = ligneMap.get(l.id) ?? 0;
          return {
            depenseId: depense!.id,
            designation: l.produit.nom,
            categorieDepense: categorieDepenseFromProduit(l.produit.categorie as CategorieProduit),
            quantite: qCetteReception,
            prixUnitaire: l.prixUnitaire,
            montantTotal: qCetteReception * l.prixUnitaire,
            produitId: l.produitId,
            ligneCommandeId: l.id,
            siteId,
          };
        });

      if (lignesDepenseData.length > 0) {
        await tx.ligneDepense.createMany({ data: lignesDepenseData });
      }
    }

    return { commande: commandeMiseAJour, depense, avertissements };
  });
}

/** Annule une commande (uniquement si BROUILLON ou ENVOYEE) */
export async function annulerCommande(id: string, siteId: string) {
  return prisma.$transaction(async (tx) => {
    const commande = await tx.commande.findFirst({
      where: { id, siteId },
    });

    if (!commande) throw new Error("Commande introuvable");

    if (
      commande.statut === StatutCommande.LIVREE ||
      commande.statut === StatutCommande.LIVREE_PARTIELLEMENT
    ) {
      throw new Error(
        "Impossible d'annuler une commande qui a deja ete (partiellement) livree"
      );
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

/** Cloture une commande partiellement livree (force LIVREE_PARTIELLEMENT -> LIVREE) */
export async function cloturerCommande(id: string, siteId: string) {
  return prisma.$transaction(async (tx) => {
    const commande = await tx.commande.findFirst({
      where: { id, siteId },
    });

    if (!commande) throw new Error("Commande introuvable");

    if (commande.statut !== StatutCommande.LIVREE_PARTIELLEMENT) {
      throw new Error(
        `Impossible de cloturer une commande avec le statut ${commande.statut}. La commande doit etre en statut LIVREE_PARTIELLEMENT.`
      );
    }

    return tx.commande.update({
      where: { id: commande.id },
      data: {
        statut: StatutCommande.LIVREE,
        dateLivraison: new Date(),
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
