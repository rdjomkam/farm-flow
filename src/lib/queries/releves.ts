import { prisma } from "@/lib/db";
import {
  StatutVague,
  TypeReleve as TypeReleveEnum,
  TypeMouvement,
  CategorieProduit,
  CauseMortalite,
  TypeAliment,
  MethodeComptage,
  StatutActivite,
  TypeActivite,
} from "@/types";
import { ACTIVITE_RELEVE_TYPE_MAP } from "@/types/api";
import type { CreateReleveDTO, UpdateReleveDTO, ReleveFilters, TypeReleve } from "@/types";
import { findMatchingActivite } from "@/lib/queries/activites";

/** Liste les releves d'un site avec filtres optionnels */
export async function getReleves(siteId: string, filters: ReleveFilters = {}) {
  const where: Record<string, unknown> = { siteId };

  if (filters.vagueId) where.vagueId = filters.vagueId;
  if (filters.bacId) where.bacId = filters.bacId;
  if (filters.typeReleve) where.typeReleve = filters.typeReleve;

  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
      ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
    };
  }

  if (filters.nonLie) {
    where.activite = null;
  }

  const releves = await prisma.releve.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return { releves, total: releves.length };
}

/** Categories de produit autorisees par type de releve */
const categorieParType: Partial<Record<string, CategorieProduit>> = {
  [TypeReleveEnum.ALIMENTATION]: CategorieProduit.ALIMENT,
  [TypeReleveEnum.QUALITE_EAU]: CategorieProduit.INTRANT,
  [TypeReleveEnum.MORTALITE]: CategorieProduit.INTRANT,
};

/** Cree un releve dans un site (verifie que le bac appartient a la vague) */
export async function createReleve(siteId: string, userId: string, data: CreateReleveDTO, activiteId?: string) {
  return prisma.$transaction(async (tx) => {
    // Verifier que le bac appartient a la vague et au site
    const bac = await tx.bac.findFirst({
      where: { id: data.bacId, siteId },
    });

    if (!bac) {
      throw new Error("Bac introuvable");
    }

    if (bac.vagueId !== data.vagueId) {
      throw new Error("Ce bac n'appartient pas a la vague selectionnee");
    }

    // Verifier que la vague existe, est en cours, et appartient au site
    const vague = await tx.vague.findFirst({
      where: { id: data.vagueId, siteId },
    });

    if (!vague) {
      throw new Error("Vague introuvable");
    }

    if (vague.statut !== StatutVague.EN_COURS) {
      throw new Error("Impossible d'ajouter un releve a une vague cloturee");
    }

    // Date auto-generee cote backend (CR-005)
    const now = new Date();

    // Construire les donnees selon le type
    const releve = await tx.releve.create({
      data: {
        date: now,
        typeReleve: data.typeReleve,
        vagueId: data.vagueId,
        bacId: data.bacId,
        siteId,
        notes: data.notes ?? null,
        // Champs biometrie
        ...("poidsMoyen" in data && { poidsMoyen: data.poidsMoyen }),
        ...("tailleMoyenne" in data && { tailleMoyenne: data.tailleMoyenne }),
        ...("echantillonCount" in data && {
          echantillonCount: data.echantillonCount,
        }),
        // Champs mortalite
        ...("nombreMorts" in data && { nombreMorts: data.nombreMorts }),
        ...("causeMortalite" in data && {
          causeMortalite: data.causeMortalite,
        }),
        // Champs alimentation
        ...("quantiteAliment" in data && {
          quantiteAliment: data.quantiteAliment,
        }),
        ...("typeAliment" in data && { typeAliment: data.typeAliment }),
        ...("frequenceAliment" in data && {
          frequenceAliment: data.frequenceAliment,
        }),
        // Champs qualite eau
        ...("temperature" in data && { temperature: data.temperature }),
        ...("ph" in data && { ph: data.ph }),
        ...("oxygene" in data && { oxygene: data.oxygene }),
        ...("ammoniac" in data && { ammoniac: data.ammoniac }),
        // Champs comptage
        ...("nombreCompte" in data && { nombreCompte: data.nombreCompte }),
        ...("methodeComptage" in data && {
          methodeComptage: data.methodeComptage,
        }),
        // Champs observation
        ...("description" in data && { description: data.description }),
      },
    });

    // Traiter les consommations de stock (optionnel)
    if (data.consommations && data.consommations.length > 0) {
      const categorieRequise = categorieParType[data.typeReleve];

      for (const conso of data.consommations) {
        const produit = await tx.produit.findFirst({
          where: { id: conso.produitId, siteId, isActive: true },
        });

        if (!produit) {
          throw new Error(`Produit introuvable: ${conso.produitId}`);
        }

        if (categorieRequise && produit.categorie !== categorieRequise) {
          throw new Error(
            `Le produit "${produit.nom}" (${produit.categorie}) n'est pas de categorie ${categorieRequise}`
          );
        }

        if (produit.stockActuel < conso.quantite) {
          throw new Error(
            `Stock insuffisant pour "${produit.nom}". Disponible : ${produit.stockActuel} ${produit.unite}, demande : ${conso.quantite}`
          );
        }

        await tx.releveConsommation.create({
          data: {
            releveId: releve.id,
            produitId: conso.produitId,
            quantite: conso.quantite,
            siteId,
          },
        });

        await tx.mouvementStock.create({
          data: {
            produitId: conso.produitId,
            type: TypeMouvement.SORTIE,
            quantite: conso.quantite,
            releveId: releve.id,
            userId,
            date: now,
            notes: `Consommation releve ${data.typeReleve}`,
            siteId,
          },
        });

        await tx.produit.update({
          where: { id: conso.produitId },
          data: { stockActuel: { decrement: conso.quantite } },
        });
      }
    }

    // Liaison Planning ↔ Releve : auto-match ou liaison explicite
    const mappedTypeActivite = Object.entries(ACTIVITE_RELEVE_TYPE_MAP).find(
      ([, relType]) => relType === data.typeReleve
    )?.[0] as TypeActivite | undefined;

    if (mappedTypeActivite) {
      if (activiteId) {
        // Liaison explicite : verifier que l'activite est valide et la lier
        const activite = await tx.activite.findFirst({
          where: {
            id: activiteId,
            siteId,
            statut: { in: [StatutActivite.PLANIFIEE, StatutActivite.EN_RETARD] },
            releveId: null,
          },
        });
        if (activite) {
          await tx.activite.update({
            where: { id: activiteId },
            data: { statut: StatutActivite.TERMINEE, releveId: releve.id, dateTerminee: new Date() },
          });
        }
      } else {
        // Auto-match : chercher une activite compatible
        const activiteMatch = await findMatchingActivite(
          tx,
          siteId,
          mappedTypeActivite,
          data.vagueId,
          now
        );
        if (activiteMatch) {
          await tx.activite.update({
            where: { id: activiteMatch.id },
            data: { statut: StatutActivite.TERMINEE, releveId: releve.id, dateTerminee: new Date() },
          });
        }
      }
    }

    return releve;
  });
}

/** Recupere un releve par son ID (scoped par site) */
export async function getReleveById(siteId: string, id: string) {
  return prisma.releve.findFirst({
    where: { id, siteId },
    include: {
      consommations: {
        include: { produit: true },
      },
    },
  });
}

/** Champs autorisés par type de releve */
const champsParType: Record<string, string[]> = {
  [TypeReleveEnum.BIOMETRIE]: ["poidsMoyen", "tailleMoyenne", "echantillonCount"],
  [TypeReleveEnum.MORTALITE]: ["nombreMorts", "causeMortalite"],
  [TypeReleveEnum.ALIMENTATION]: ["quantiteAliment", "typeAliment", "frequenceAliment"],
  [TypeReleveEnum.QUALITE_EAU]: ["temperature", "ph", "oxygene", "ammoniac"],
  [TypeReleveEnum.COMPTAGE]: ["nombreCompte", "methodeComptage"],
  [TypeReleveEnum.OBSERVATION]: ["description"],
};

/** Met a jour un releve (seuls les champs du type sont modifiables, typeReleve immutable) */
export async function updateReleve(siteId: string, userId: string, id: string, data: UpdateReleveDTO) {
  return prisma.$transaction(async (tx) => {
    const releve = await tx.releve.findFirst({ where: { id, siteId } });
    if (!releve) throw new Error("Releve introuvable");

    const allowed = champsParType[releve.typeReleve] ?? [];
    const updateData: Record<string, unknown> = {};

    // notes est commun a tous les types
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Filtrer uniquement les champs autorisés pour ce type
    for (const field of allowed) {
      const value = (data as Record<string, unknown>)[field];
      if (value !== undefined) updateData[field] = value;
    }

    const updatedReleve = await tx.releve.update({
      where: { id },
      data: updateData,
    });

    // Gerer les consommations si fournies (remplace completement les consommations existantes)
    if (data.consommations !== undefined) {
      const typesAvecConsommations = [
        TypeReleveEnum.ALIMENTATION,
        TypeReleveEnum.MORTALITE,
        TypeReleveEnum.QUALITE_EAU,
      ] as string[];

      if (!typesAvecConsommations.includes(releve.typeReleve)) {
        throw new Error(
          `Les consommations ne sont pas applicables au type de releve ${releve.typeReleve}`
        );
      }

      // 1. Recuperer les anciennes consommations
      const anciennesConsommations = await tx.releveConsommation.findMany({
        where: { releveId: id, siteId },
      });

      // 2. Supprimer les anciens mouvements de stock SORTIE lies a ce releve
      await tx.mouvementStock.deleteMany({
        where: {
          releveId: id,
          siteId,
          type: TypeMouvement.SORTIE,
        },
      });

      // 3. Restaurer le stock des anciennes consommations
      for (const ancienne of anciennesConsommations) {
        await tx.produit.update({
          where: { id: ancienne.produitId },
          data: { stockActuel: { increment: ancienne.quantite } },
        });
      }

      // 4. Supprimer les anciennes ReleveConsommation
      await tx.releveConsommation.deleteMany({
        where: { releveId: id, siteId },
      });

      // 5. Creer les nouvelles consommations si non vides
      if (data.consommations.length > 0) {
        const categorieRequise = categorieParType[releve.typeReleve];
        const now = new Date();

        for (const conso of data.consommations) {
          const produit = await tx.produit.findFirst({
            where: { id: conso.produitId, siteId, isActive: true },
          });

          if (!produit) {
            throw new Error(`Produit introuvable: ${conso.produitId}`);
          }

          if (categorieRequise && produit.categorie !== categorieRequise) {
            throw new Error(
              `Le produit "${produit.nom}" (${produit.categorie}) n'est pas de categorie ${categorieRequise}`
            );
          }

          if (produit.stockActuel < conso.quantite) {
            throw new Error(
              `Stock insuffisant pour "${produit.nom}". Disponible : ${produit.stockActuel} ${produit.unite}, demande : ${conso.quantite}`
            );
          }

          await tx.releveConsommation.create({
            data: {
              releveId: id,
              produitId: conso.produitId,
              quantite: conso.quantite,
              siteId,
            },
          });

          await tx.mouvementStock.create({
            data: {
              produitId: conso.produitId,
              type: TypeMouvement.SORTIE,
              quantite: conso.quantite,
              releveId: id,
              userId,
              date: now,
              notes: `Modification releve ${releve.typeReleve}`,
              siteId,
            },
          });

          await tx.produit.update({
            where: { id: conso.produitId },
            data: { stockActuel: { decrement: conso.quantite } },
          });
        }
      }
    }

    return updatedReleve;
  });
}

/** Recupere les releves d'une vague filtres par type (scoped par site) */
export async function getRelevesByType(siteId: string, vagueId: string, type: TypeReleve) {
  return prisma.releve.findMany({
    where: { siteId, vagueId, typeReleve: type },
    orderBy: { date: "desc" },
  });
}
