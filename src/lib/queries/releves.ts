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
import type { ReleveWithModifications, ReleveModificationWithUser } from "@/types";
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

  if (filters.modifie !== undefined) {
    where.modifie = filters.modifie;
  }

  const releves = await prisma.releve.findMany({
    where,
    orderBy: { updatedAt: "desc" },
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

    // Date : saisie si fournie et valide, sinon maintenant
    const releveDate = data.date ? new Date(data.date) : new Date();

    // Validation : la date ne peut pas etre anterieure a la dateDebut de la vague
    if (releveDate < vague.dateDebut) {
      throw new Error(
        `La date du releve ne peut pas etre anterieure au debut de la vague (${vague.dateDebut.toISOString().split("T")[0]}).`
      );
    }

    // Construire les donnees selon le type
    const releve = await tx.releve.create({
      data: {
        date: releveDate,
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
            date: releveDate,
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
          releveDate
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

/** Recupere un releve par son ID (scoped par site) — inclut modifications et consommations */
export async function getReleveById(siteId: string, id: string) {
  return prisma.releve.findFirst({
    where: { id, siteId },
    include: {
      consommations: {
        include: { produit: true },
      },
      modifications: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
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

    // date et notes sont communs a tous les types
    if (data.date !== undefined) updateData.date = data.date;
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
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Met a jour un releve avec traçabilite obligatoire de la raison (ADR-014).
 *
 * Transaction atomique :
 * 1. Verifie que le releve appartient au site
 * 2. Verifie que la vague est EN_COURS
 * 3. Filtre les champs autorises pour le typeReleve
 * 4. Detecte les champs modifies (comparaison ancienne/nouvelle valeur)
 * 5. Met a jour le releve (+ modifie = true)
 * 6. Cree une ReleveModification par champ modifie
 * 7. Gere les consommations si fournies
 *
 * @param siteId  - site de l'utilisateur (isolation multi-tenant)
 * @param userId  - utilisateur effectuant la modification (pour la trace)
 * @param id      - identifiant du releve
 * @param data    - champs modifiables (PatchReleveBody sans raison)
 * @param raison  - raison obligatoire (min 5 chars, deja validee en route)
 */
export async function patchReleve(
  siteId: string,
  userId: string,
  id: string,
  data: UpdateReleveDTO,
  raison: string
): Promise<{ releve: ReleveWithModifications; modifications: ReleveModificationWithUser[] }> {
  return prisma.$transaction(async (tx) => {
    // 1. Verifier existence et recuperer anciennes valeurs
    const releve = await tx.releve.findFirst({ where: { id, siteId } });
    if (!releve) throw new Error("Releve introuvable");

    // 2. Verifier que la vague est EN_COURS
    const vague = await tx.vague.findFirst({ where: { id: releve.vagueId, siteId } });
    if (!vague) throw new Error("Vague introuvable");
    if (vague.statut !== StatutVague.EN_COURS) {
      throw new Error("Impossible de modifier un releve sur une vague cloturee");
    }

    // 3. Filtrer les champs autorises pour ce typeReleve
    const allowed = champsParType[releve.typeReleve] ?? [];
    const updateData: Record<string, unknown> = {};

    if (data.date !== undefined) updateData.date = data.date;
    if (data.notes !== undefined) updateData.notes = data.notes;

    for (const field of allowed) {
      const value = (data as Record<string, unknown>)[field];
      if (value !== undefined) updateData[field] = value;
    }

    // 4. Detecter les champs modifies et construire les traces
    const traces: Array<{
      id: string;
      releveId: string;
      userId: string;
      raison: string;
      champModifie: string;
      ancienneValeur: string | null;
      nouvelleValeur: string | null;
      siteId: string;
    }> = [];

    const allFields = ["date", "notes", ...allowed];
    for (const field of allFields) {
      const nouvelleValeur = updateData[field];
      if (nouvelleValeur === undefined) continue;

      const ancienneRaw = (releve as Record<string, unknown>)[field];
      const ancienneValeur = ancienneRaw === null || ancienneRaw === undefined
        ? null
        : String(ancienneRaw);
      const nouvelleStr = nouvelleValeur === null || nouvelleValeur === undefined
        ? null
        : String(nouvelleValeur);

      // Creer une trace seulement si la valeur a change
      if (ancienneValeur !== nouvelleStr) {
        traces.push({
          id: crypto.randomUUID(),
          releveId: id,
          userId,
          raison,
          champModifie: field,
          ancienneValeur,
          nouvelleValeur: nouvelleStr,
          siteId,
        });
      }
    }

    // Verifier qu'au moins un champ est modifie (hors consommations)
    const hasConsommations = data.consommations !== undefined;
    if (traces.length === 0 && !hasConsommations) {
      throw new Error("Aucun champ n'a ete modifie");
    }

    // 5. Mettre a jour le releve
    await tx.releve.update({
      where: { id },
      data: {
        ...updateData,
        modifie: true,
      },
    });

    // 6. Creer les traces de modification
    if (traces.length > 0) {
      await tx.releveModification.createMany({ data: traces });
    }

    // 7. Gerer les consommations si fournies (meme logique que updateReleve)
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

      // Recuperer les anciennes consommations
      const anciennesConsommations = await tx.releveConsommation.findMany({
        where: { releveId: id, siteId },
      });

      // Supprimer les anciens mouvements de stock SORTIE lies a ce releve
      await tx.mouvementStock.deleteMany({
        where: { releveId: id, siteId, type: TypeMouvement.SORTIE },
      });

      // Restaurer le stock des anciennes consommations
      for (const ancienne of anciennesConsommations) {
        await tx.produit.update({
          where: { id: ancienne.produitId },
          data: { stockActuel: { increment: ancienne.quantite } },
        });
      }

      // Supprimer les anciennes ReleveConsommation
      await tx.releveConsommation.deleteMany({ where: { releveId: id, siteId } });

      // Creer les nouvelles consommations si non vides
      if (data.consommations.length > 0) {
        const categorieRequise = categorieParType[releve.typeReleve];
        const now = new Date();

        for (const conso of data.consommations) {
          const produit = await tx.produit.findFirst({
            where: { id: conso.produitId, siteId, isActive: true },
          });

          if (!produit) throw new Error(`Produit introuvable: ${conso.produitId}`);

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
            data: { releveId: id, produitId: conso.produitId, quantite: conso.quantite, siteId },
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

    // 8. Recuperer le releve mis a jour avec toutes ses relations
    const updatedReleve = await tx.releve.findFirst({
      where: { id, siteId },
      include: {
        consommations: { include: { produit: true } },
        modifications: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!updatedReleve) throw new Error("Erreur interne : releve introuvable apres mise a jour");

    // Cast vers le type de retour
    const result = updatedReleve as unknown as ReleveWithModifications;
    const newModifications = result.modifications.filter(
      (m) => traces.some((t) => t.champModifie === m.champModifie && t.raison === m.raison)
    ) as ReleveModificationWithUser[];

    return { releve: result, modifications: newModifications };
  });
}

/**
 * @deprecated Remplacee par l'implementation complete ci-dessus.
 * Cette implementation est conservee pour reference uniquement et ne sera pas exportee.
 */
async function _patchReleve_deprecated(
  siteId: string,
  userId: string,
  id: string,
  data: UpdateReleveDTO,
  raison: string
) {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch existing releve
    const releve = await tx.releve.findFirst({ where: { id, siteId } });
    if (!releve) throw new Error("Releve introuvable");

    // 2. Verify vague is EN_COURS
    const vague = await tx.vague.findFirst({ where: { id: releve.vagueId, siteId } });
    if (!vague) throw new Error("Vague introuvable");
    if (vague.statut !== StatutVague.EN_COURS) {
      throw new Error("Impossible de modifier un releve d'une vague cloturee");
    }

    // 3. Determine allowed fields for this typeReleve
    const allowed = champsParType[releve.typeReleve] ?? [];
    const updateData: Record<string, unknown> = { modifie: true };

    if (data.notes !== undefined) updateData.notes = data.notes;
    for (const field of allowed) {
      const value = (data as Record<string, unknown>)[field];
      if (value !== undefined) updateData[field] = value;
    }

    // 4. Build modification traces (one per modified field)
    const traces: {
      id: string;
      releveId: string;
      userId: string;
      raison: string;
      champModifie: string;
      ancienneValeur: string | null;
      nouvelleValeur: string | null;
      siteId: string;
    }[] = [];

    const modifiedFields = Object.keys(updateData).filter((k) => k !== "modifie");
    for (const field of modifiedFields) {
      const ancienne = (releve as Record<string, unknown>)[field];
      const nouvelle = updateData[field];
      // Only trace if value actually changed
      if (String(ancienne ?? "") !== String(nouvelle ?? "")) {
        traces.push({
          id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          releveId: id,
          userId,
          raison,
          champModifie: field,
          ancienneValeur: ancienne != null ? String(ancienne) : null,
          nouvelleValeur: nouvelle != null ? String(nouvelle) : null,
          siteId,
        });
      }
    }

    // 5. Apply update
    await tx.releve.update({ where: { id }, data: updateData });

    // 6. Create modification traces
    if (traces.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).releveModification.createMany({ data: traces });
    }

    // 7. Handle consommations if provided (same logic as updateReleve)
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

      const anciennesConsommations = await tx.releveConsommation.findMany({
        where: { releveId: id, siteId },
      });

      await tx.mouvementStock.deleteMany({
        where: { releveId: id, siteId, type: TypeMouvement.SORTIE },
      });

      for (const ancienne of anciennesConsommations) {
        await tx.produit.update({
          where: { id: ancienne.produitId },
          data: { stockActuel: { increment: ancienne.quantite } },
        });
      }

      await tx.releveConsommation.deleteMany({ where: { releveId: id, siteId } });

      if (data.consommations.length > 0) {
        const categorieRequise = categorieParType[releve.typeReleve];
        const now = new Date();

        for (const conso of data.consommations) {
          const produit = await tx.produit.findFirst({
            where: { id: conso.produitId, siteId, isActive: true },
          });
          if (!produit) throw new Error(`Produit introuvable: ${conso.produitId}`);
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
            data: { releveId: id, produitId: conso.produitId, quantite: conso.quantite, siteId },
          });

          await tx.mouvementStock.create({
            data: {
              produitId: conso.produitId,
              type: TypeMouvement.SORTIE,
              quantite: conso.quantite,
              releveId: id,
              userId,
              date: now,
              notes: `Modification (avec raison) releve ${releve.typeReleve}`,
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

    // 8. Fetch updated releve with modifications and consommations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const releveModif = await (tx as any).releveModification.findMany({
      where: { releveId: id },
      orderBy: { createdAt: "desc" as const },
      include: { user: { select: { id: true, name: true } } },
    });

    const releveUpdated = await tx.releve.findFirst({
      where: { id },
      include: {
        consommations: { include: { produit: true } },
      },
    });

    return {
      releve: { ...releveUpdated, modifications: releveModif },
      modifications: releveModif,
    };
  });
}
