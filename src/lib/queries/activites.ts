import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { StatutActivite, TypeActivite } from "@/types";
import { RELEVE_COMPATIBLE_TYPES } from "@/types/api";
import type { ActiviteFilters, CreateActiviteDTO, UpdateActiviteDTO, CompleteActiviteDTO } from "@/types";

// ---------------------------------------------------------------------------
// Queries Activite
// ---------------------------------------------------------------------------

/**
 * Liste les activites d'un site avec filtres optionnels.
 * Inclut les relations vague, bac et assigneA.
 * Utilisee pour le calendrier (dateDebut/dateFin) et les vues filtrées.
 *
 * @param siteId  - ID du site (R8)
 * @param filters - Filtres optionnels
 */
export async function getActivites(siteId: string, filters?: ActiviteFilters) {
  const where: Record<string, unknown> = { siteId };

  if (filters?.statut) where.statut = filters.statut;
  if (filters?.typeActivite) where.typeActivite = filters.typeActivite;
  if (filters?.vagueId) where.vagueId = filters.vagueId;
  if (filters?.assigneAId) where.assigneAId = filters.assigneAId;

  // Filtre de periode pour le calendrier : dateDebut dans la plage donnee
  if (filters?.dateDebut || filters?.dateFin) {
    where.dateDebut = {
      ...(filters.dateDebut && { gte: new Date(filters.dateDebut) }),
      ...(filters.dateFin && { lte: new Date(filters.dateFin) }),
    };
  }

  return prisma.activite.findMany({
    where,
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      assigneA: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      releve: { select: { id: true, typeReleve: true, date: true } },
      produitRecommande: {
        select: {
          id: true,
          nom: true,
          unite: true,
          uniteAchat: true,
          contenance: true,
          stockActuel: true,
        },
      },
    },
    orderBy: { dateDebut: "asc" },
  });
}

/**
 * Recupere une activite par ID (verifie l'appartenance au site).
 *
 * @param siteId - ID du site (R8)
 * @param id     - ID de l'activite
 */
export async function getActiviteById(siteId: string, id: string) {
  return prisma.activite.findFirst({
    where: { id, siteId },
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      assigneA: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      releve: { select: { id: true, typeReleve: true, date: true } },
      produitRecommande: {
        select: {
          id: true,
          nom: true,
          unite: true,
          uniteAchat: true,
          contenance: true,
          stockActuel: true,
        },
      },
    },
  });
}

/**
 * Recherche une activite PLANIFIEE ou EN_RETARD correspondant a un releve cree.
 * Utilisee pour l'auto-match Planning ↔ Releve.
 *
 * Criteres de correspondance :
 * - typeActivite mappee depuis typeReleve (via ACTIVITE_RELEVE_TYPE_MAP inverse)
 * - statut PLANIFIEE ou EN_RETARD
 * - meme vague (si vagueId fourni)
 * - dateDebut dans la fenetre ±1 jour de la date du releve
 * - releveId IS NULL (pas encore liee)
 * - meme site (R8)
 *
 * @param tx        - Client Prisma transactionnel
 * @param siteId    - ID du site (R8)
 * @param typeReleve - Type du releve cree (type activite compatible)
 * @param vagueId   - ID de la vague du releve (nullable)
 * @param date      - Date du releve
 * @returns La premiere activite correspondante (ORDER BY dateDebut ASC), ou null
 */
export async function findMatchingActivite(
  tx: Prisma.TransactionClient,
  siteId: string,
  typeReleve: TypeActivite,
  vagueId: string | null,
  date: Date
) {
  const unJour = 24 * 60 * 60 * 1000;
  const dateMin = new Date(date.getTime() - unJour);
  const dateMax = new Date(date.getTime() + unJour);

  return tx.activite.findFirst({
    where: {
      siteId,
      typeActivite: typeReleve,
      statut: { in: [StatutActivite.PLANIFIEE, StatutActivite.EN_RETARD] },
      ...(vagueId && { vagueId }),
      dateDebut: { gte: dateMin, lte: dateMax },
      releveId: null,
    },
    orderBy: { dateDebut: "asc" },
  });
}

/**
 * Cree une nouvelle activite.
 * Verifie que vague et bac (si fournis) appartiennent au site.
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur qui cree l'activite
 * @param data   - Donnees de l'activite
 */
export async function createActivite(
  siteId: string,
  userId: string,
  data: CreateActiviteDTO
) {
  // Verifier que la vague appartient au site si fournie
  if (data.vagueId) {
    const vague = await prisma.vague.findFirst({
      where: { id: data.vagueId, siteId },
    });
    if (!vague) throw new Error("Vague introuvable");
  }

  // Verifier que le bac appartient au site si fourni
  if (data.bacId) {
    const bac = await prisma.bac.findFirst({
      where: { id: data.bacId, siteId },
    });
    if (!bac) throw new Error("Bac introuvable");
  }

  return prisma.activite.create({
    data: {
      titre: data.titre,
      description: data.description ?? null,
      typeActivite: data.typeActivite,
      statut: StatutActivite.PLANIFIEE,
      dateDebut: new Date(data.dateDebut),
      dateFin: data.dateFin ? new Date(data.dateFin) : null,
      recurrence: data.recurrence ?? null,
      vagueId: data.vagueId ?? null,
      bacId: data.bacId ?? null,
      assigneAId: data.assigneAId ?? null,
      userId,
      siteId,
    },
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      assigneA: { select: { id: true, name: true } },
    },
  });
}

/**
 * Met a jour une activite existante (modification partielle).
 * Verifie l'appartenance au site (R8).
 *
 * @param siteId - ID du site (R8)
 * @param id     - ID de l'activite
 * @param data   - Champs a mettre a jour
 */
export async function updateActivite(
  siteId: string,
  id: string,
  data: UpdateActiviteDTO
) {
  // Fetch current activity to check statut lock
  const current = await prisma.activite.findFirst({ where: { id, siteId } });
  if (!current) throw new Error("Activite introuvable");

  // Reject statut=TERMINEE via PUT — must use /complete endpoint
  if (data.statut === StatutActivite.TERMINEE) {
    throw new Error("Utilisez POST /api/activites/[id]/complete pour completer une activite");
  }

  const isLocked =
    current.statut === StatutActivite.TERMINEE ||
    current.statut === StatutActivite.ANNULEE;

  // If TERMINEE/ANNULEE, only description and noteCompletion are editable
  if (isLocked) {
    const updateData: Record<string, unknown> = {};
    if (data.description !== undefined) updateData.description = data.description;
    // noteCompletion can also be edited on locked activities
    if ((data as Record<string, unknown>).noteCompletion !== undefined) {
      updateData.noteCompletion = (data as Record<string, unknown>).noteCompletion;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("Activite terminee ou annulee : seuls la description et la note de completion sont modifiables");
    }

    await prisma.activite.updateMany({
      where: { id, siteId },
      data: updateData,
    });

    return prisma.activite.findFirst({
      where: { id, siteId },
      include: {
        vague: { select: { id: true, code: true } },
        bac: { select: { id: true, nom: true } },
        assigneA: { select: { id: true, name: true } },
      },
    });
  }

  // PLANIFIEE/EN_RETARD — full edit allowed
  // Verifier que la vague appartient au site si fournie
  if (data.vagueId) {
    const vague = await prisma.vague.findFirst({
      where: { id: data.vagueId, siteId },
    });
    if (!vague) throw new Error("Vague introuvable");
  }

  // Verifier que le bac appartient au site si fourni
  if (data.bacId) {
    const bac = await prisma.bac.findFirst({
      where: { id: data.bacId, siteId },
    });
    if (!bac) throw new Error("Bac introuvable");
  }

  await prisma.activite.updateMany({
    where: { id, siteId },
    data: {
      ...(data.titre !== undefined && { titre: data.titre }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.statut !== undefined && { statut: data.statut }),
      ...(data.dateDebut !== undefined && { dateDebut: new Date(data.dateDebut) }),
      ...(data.dateFin !== undefined && {
        dateFin: data.dateFin ? new Date(data.dateFin) : null,
      }),
      ...(data.recurrence !== undefined && {
        recurrence: data.recurrence ?? null,
      }),
      ...(data.vagueId !== undefined && { vagueId: data.vagueId ?? null }),
      ...(data.bacId !== undefined && { bacId: data.bacId ?? null }),
      ...(data.assigneAId !== undefined && {
        assigneAId: data.assigneAId ?? null,
      }),
    },
  });

  return prisma.activite.findFirst({
    where: { id, siteId },
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      assigneA: { select: { id: true, name: true } },
    },
  });
}

/**
 * Supprime une activite.
 * Verifie l'appartenance au site (R8).
 *
 * @param siteId - ID du site (R8)
 * @param id     - ID de l'activite
 */
export async function deleteActivite(siteId: string, id: string): Promise<void> {
  const result = await prisma.activite.deleteMany({
    where: { id, siteId },
  });

  if (result.count === 0) {
    throw new Error("Activite introuvable");
  }
}

/**
 * Retourne les activites prevues pour aujourd'hui (utilisee par le dashboard).
 * Inclut les activites dont dateDebut est dans la journee en cours.
 *
 * @param siteId - ID du site (R8)
 */
export async function getActivitesAujourdhui(siteId: string) {
  const now = new Date();
  const debutJournee = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const finJournee = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  return prisma.activite.findMany({
    where: {
      siteId,
      dateDebut: {
        gte: debutJournee,
        lte: finJournee,
      },
    },
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      assigneA: { select: { id: true, name: true } },
    },
    orderBy: { dateDebut: "asc" },
  });
}

/**
 * Marque en EN_RETARD toutes les activites PLANIFIEE dont la date de debut
 * est passee. Retourne le nombre d'activites mises a jour.
 *
 * @param siteId - ID du site (R8)
 */
export async function marquerActivitesEnRetard(siteId: string): Promise<number> {
  const now = new Date();

  const result = await prisma.activite.updateMany({
    where: {
      siteId,
      statut: StatutActivite.PLANIFIEE,
      dateDebut: { lt: now },
    },
    data: { statut: StatutActivite.EN_RETARD },
  });

  return result.count;
}

/**
 * Complete une activite (transition vers TERMINEE avec evidence).
 *
 * Types releve-compatibles (ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE) :
 *   → requirent un releveId valide (non deja lie)
 * Types non-releve (NETTOYAGE, TRAITEMENT, RECOLTE, AUTRE) :
 *   → requirent une noteCompletion non vide
 *
 * @param siteId - ID du site (R8)
 * @param id     - ID de l'activite
 * @param data   - releveId OU noteCompletion
 */
export async function completeActivite(
  siteId: string,
  id: string,
  data: CompleteActiviteDTO
) {
  return prisma.$transaction(async (tx) => {
    const activite = await tx.activite.findFirst({ where: { id, siteId } });
    if (!activite) throw new Error("Activite introuvable");

    if (
      activite.statut !== StatutActivite.PLANIFIEE &&
      activite.statut !== StatutActivite.EN_RETARD
    ) {
      throw new Error("Seules les activites PLANIFIEE ou EN_RETARD peuvent etre completees");
    }

    const isReleveType = RELEVE_COMPATIBLE_TYPES.includes(activite.typeActivite as TypeActivite);

    if (isReleveType) {
      if (!data.releveId) {
        throw new Error("Un releve est requis pour completer ce type d'activite");
      }
      // Verify releve exists, belongs to site, and is not already linked
      const releve = await tx.releve.findFirst({
        where: { id: data.releveId, siteId },
      });
      if (!releve) throw new Error("Releve introuvable");

      const alreadyLinked = await tx.activite.findFirst({
        where: { releveId: data.releveId },
      });
      if (alreadyLinked) throw new Error("Ce releve est deja lie a une autre activite");

      return tx.activite.update({
        where: { id },
        data: {
          statut: StatutActivite.TERMINEE,
          dateTerminee: new Date(),
          releveId: data.releveId,
        },
        include: {
          vague: { select: { id: true, code: true } },
          bac: { select: { id: true, nom: true } },
          assigneA: { select: { id: true, name: true } },
          releve: { select: { id: true, typeReleve: true, date: true } },
        },
      });
    } else {
      if (!data.noteCompletion || data.noteCompletion.trim().length < 10) {
        throw new Error("Une note de completion (minimum 10 caracteres) est requise pour ce type d'activite");
      }

      return tx.activite.update({
        where: { id },
        data: {
          statut: StatutActivite.TERMINEE,
          dateTerminee: new Date(),
          noteCompletion: data.noteCompletion.trim(),
        },
        include: {
          vague: { select: { id: true, code: true } },
          bac: { select: { id: true, nom: true } },
          assigneA: { select: { id: true, name: true } },
        },
      });
    }
  });
}

/**
 * Retourne les taches en attente d'un utilisateur (assigneAId = userId).
 * Filtre : statut IN (PLANIFIEE, EN_RETARD), trie par dateDebut ASC.
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur
 */
export async function getMyTasks(siteId: string, userId: string) {
  return prisma.activite.findMany({
    where: {
      siteId,
      assigneAId: userId,
      statut: { in: [StatutActivite.PLANIFIEE, StatutActivite.EN_RETARD] },
    },
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      assigneA: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { dateDebut: "asc" },
  });
}

/**
 * Retourne le nombre de taches en attente d'un utilisateur.
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur
 */
export async function getPendingTaskCount(siteId: string, userId: string) {
  return prisma.activite.count({
    where: {
      siteId,
      assigneAId: userId,
      statut: { in: [StatutActivite.PLANIFIEE, StatutActivite.EN_RETARD] },
    },
  });
}

/**
 * Retourne toutes les taches d'un utilisateur (tous statuts).
 * Utilisee par la page "Mes taches" enrichie (S16-1) pour permettre
 * le filtrage par statut cote client.
 *
 * @param siteId - ID du site (R8)
 * @param userId - ID de l'utilisateur
 */
export async function getAllMyTasks(siteId: string, userId: string) {
  return prisma.activite.findMany({
    where: {
      siteId,
      assigneAId: userId,
    },
    include: {
      vague: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      assigneA: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      regle: { select: { id: true, nom: true, typeActivite: true } },
    },
    orderBy: [{ priorite: "desc" }, { dateDebut: "asc" }],
  });
}

// Re-export des types pour compatibilite avec les imports existants
export type { TypeActivite };
