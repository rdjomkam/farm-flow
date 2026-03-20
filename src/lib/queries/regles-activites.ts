import { prisma } from "@/lib/db";
import { TypeDeclencheur, PhaseElevage } from "@/types";
import { SEUIL_TYPES_FIREDONCE } from "@/lib/regles-activites-constants";
import type {
  CreateRegleActiviteDTO,
  UpdateRegleActiviteDTO,
  RegleActiviteFilters,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates phaseMin <= phaseMax according to EC-3.5.
 *
 * Phase order : ACCLIMATATION(0) < CROISSANCE_DEBUT(1) < JUVENILE(2)
 *               < GROSSISSEMENT(3) < FINITION(4) < PRE_RECOLTE(5)
 */
const PHASE_ORDER: Record<PhaseElevage, number> = {
  [PhaseElevage.ACCLIMATATION]: 0,
  [PhaseElevage.CROISSANCE_DEBUT]: 1,
  [PhaseElevage.JUVENILE]: 2,
  [PhaseElevage.GROSSISSEMENT]: 3,
  [PhaseElevage.FINITION]: 4,
  [PhaseElevage.PRE_RECOLTE]: 5,
};

function validatePhaseRange(
  phaseMin?: PhaseElevage | null,
  phaseMax?: PhaseElevage | null
): void {
  if (phaseMin && phaseMax) {
    if (PHASE_ORDER[phaseMin] > PHASE_ORDER[phaseMax]) {
      throw new Error(
        `phaseMin (${phaseMin}) doit etre inferieure ou egale a phaseMax (${phaseMax}).`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Liste les regles d'activite avec filtres optionnels.
 *
 * - siteId (string)  : regles du site + regles globales (si includeGlobal n'est pas false)
 * - siteId (null)    : regles globales uniquement
 * - siteId omis      : toutes les regles (contexte admin cross-site)
 * - filters.includeGlobal (defaut true) : inclure les regles globales (siteId=null)
 *
 * Ordonnees par typeDeclencheur ASC, priorite ASC (spec Story 25.1).
 * Inclut _count.activites (nombre d'activites generees par cette regle).
 *
 * R8 : le siteId est obligatoire dans les usages normaux — omettre siteId
 *      uniquement dans les contextes d'administration cross-site.
 *
 * @param siteId  - ID du site, null pour globals seulement, undefined pour tout
 * @param filters - Filtres optionnels
 */
export async function getReglesActivites(
  siteId?: string | null,
  filters?: RegleActiviteFilters
) {
  const includeGlobal = filters?.includeGlobal !== false;

  // Build the siteId where clause
  let siteWhere: Record<string, unknown> = {};

  if (siteId === undefined) {
    // Admin cross-site : no restriction
    siteWhere = {};
  } else if (siteId === null) {
    // Global rules only
    siteWhere = { siteId: null };
  } else if (includeGlobal) {
    // Site-specific rules + global rules
    siteWhere = { OR: [{ siteId }, { siteId: null }] };
  } else {
    // Site-specific rules only
    siteWhere = { siteId };
  }

  return prisma.regleActivite.findMany({
    where: {
      ...siteWhere,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(filters?.typeActivite && { typeActivite: filters.typeActivite as any }),
      ...(filters?.typeDeclencheur && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeDeclencheur: filters.typeDeclencheur as any,
      }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
    },
    include: {
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      _count: { select: { activites: true } },
    },
    orderBy: [{ typeDeclencheur: "asc" }, { priorite: "asc" }],
  });
}

/**
 * Recupere une regle par ID avec _count.activites.
 *
 * Retourne la regle si elle appartient au site OU si c'est une regle globale
 * (siteId=null). Passe siteId pour contraindre l'acces (R8).
 *
 * Inclut les 10 activites les plus recentes generees par cette regle.
 *
 * @param id     - ID de la regle
 * @param siteId - ID du site pour limiter l'acces (optionnel en contexte admin)
 */
export async function getRegleActiviteById(id: string, siteId?: string) {
  const siteWhere =
    siteId !== undefined
      ? { OR: [{ siteId }, { siteId: null }] }
      : {};

  return prisma.regleActivite.findFirst({
    where: {
      id,
      ...siteWhere,
    },
    include: {
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      _count: { select: { activites: true } },
      activites: {
        select: { id: true, titre: true, statut: true, dateDebut: true },
        orderBy: { dateDebut: "desc" },
        take: 10,
      },
    },
  });
}

/**
 * Cree une regle d'activite propre au site.
 *
 * Regles metier :
 * - siteId doit etre non-null (les regles globales sont exclusivement seed-only).
 * - Validation EC-3.5 : phaseMin doit preceder phaseMax dans l'ordre des phases.
 *
 * R8 : le siteId est toujours positionne sur la regle creee.
 *
 * @param siteId - ID du site proprietaire (non-null)
 * @param userId - ID de l'utilisateur createur
 * @param data   - Donnees de la regle (champs alignes sur CreateRegleActiviteDTO)
 */
export async function createRegleActivite(
  siteId: string,
  userId: string,
  data: CreateRegleActiviteDTO
) {
  validatePhaseRange(data.phaseMin ?? null, data.phaseMax ?? null);

  return prisma.regleActivite.create({
    data: {
      nom: data.nom,
      description: data.description ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeActivite: data.typeActivite as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeDeclencheur: data.typeDeclencheur as any,
      conditionValeur: data.conditionValeur ?? null,
      conditionValeur2: data.conditionValeur2 ?? null,
      phaseMin: data.phaseMin ?? null,
      phaseMax: data.phaseMax ?? null,
      intervalleJours: data.intervalleJours ?? null,
      titreTemplate: data.titreTemplate,
      descriptionTemplate: data.descriptionTemplate ?? null,
      instructionsTemplate: data.instructionsTemplate ?? null,
      priorite: data.priorite ?? 5,
      isActive: data.isActive ?? true,
      firedOnce: false,
      siteId,
      userId,
    },
    include: {
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
  });
}

/**
 * Met a jour les champs editables d'une regle d'activite.
 *
 * Champs editables : nom, description, titreTemplate, descriptionTemplate,
 * instructionsTemplate, priorite, isActive, intervalleJours,
 * conditionValeur, conditionValeur2, phaseMin, phaseMax.
 *
 * Regles metier :
 * - Interdit de modifier une regle globale (siteId=null) par cette fonction.
 * - R4 : updateMany avec condition atomique sur siteId.
 * - Validation EC-3.5 : phaseMin doit preceder phaseMax si les deux sont fournis.
 *
 * @param id     - ID de la regle
 * @param siteId - ID du site proprietaire (R8)
 * @param data   - Champs a mettre a jour
 */
export async function updateRegleActivite(
  id: string,
  siteId: string,
  data: UpdateRegleActiviteDTO,
  options?: { allowGlobal?: boolean }
) {
  // Refuse modification of global rules (siteId=null) for non-admin callers
  const existing = await prisma.regleActivite.findFirst({
    where: { id },
    select: { id: true, siteId: true },
  });

  if (!existing) throw new Error("Regle introuvable.");

  if (existing.siteId === null && !options?.allowGlobal) {
    throw new Error(
      "Les regles globales DKFarm ne peuvent pas etre modifiees. Creez une regle specifique a votre site."
    );
  }

  if (existing.siteId !== null && existing.siteId !== siteId) {
    throw new Error("Regle introuvable.");
  }

  // Validate phase range if both bounds are present in the update
  if (data.phaseMin !== undefined && data.phaseMax !== undefined) {
    validatePhaseRange(data.phaseMin ?? null, data.phaseMax ?? null);
  }

  // R4 : atomic updateMany — use { id } for global rules, { id, siteId } for site rules
  const whereClause = existing.siteId === null ? { id } : { id, siteId };
  const result = await prisma.regleActivite.updateMany({
    where: whereClause,
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.description !== undefined && {
        description: data.description ?? null,
      }),
      ...(data.typeActivite !== undefined && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeActivite: data.typeActivite as any,
      }),
      ...(data.typeDeclencheur !== undefined && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeDeclencheur: data.typeDeclencheur as any,
      }),
      ...(data.conditionValeur !== undefined && {
        conditionValeur: data.conditionValeur ?? null,
      }),
      ...(data.conditionValeur2 !== undefined && {
        conditionValeur2: data.conditionValeur2 ?? null,
      }),
      ...(data.phaseMin !== undefined && { phaseMin: data.phaseMin ?? null }),
      ...(data.phaseMax !== undefined && { phaseMax: data.phaseMax ?? null }),
      ...(data.intervalleJours !== undefined && {
        intervalleJours: data.intervalleJours ?? null,
      }),
      ...(data.titreTemplate !== undefined && {
        titreTemplate: data.titreTemplate,
      }),
      ...(data.descriptionTemplate !== undefined && {
        descriptionTemplate: data.descriptionTemplate ?? null,
      }),
      ...(data.instructionsTemplate !== undefined && {
        instructionsTemplate: data.instructionsTemplate ?? null,
      }),
      ...(data.priorite !== undefined && { priorite: data.priorite }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  if (result.count === 0) throw new Error("Regle introuvable.");

  return prisma.regleActivite.findFirst({
    where: whereClause,
    include: {
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
  });
}

/**
 * Supprime une regle d'activite site-specifique.
 *
 * Retourne { error: "global" } si la regle est globale (siteId=null).
 * Retourne { error: "linked" } si des activites sont liees a cette regle.
 * Retourne { success: true } apres suppression reussie.
 *
 * R4 : deleteMany atomique avec condition sur siteId.
 *
 * @param id     - ID de la regle
 * @param siteId - ID du site proprietaire (R8)
 */
export async function deleteRegleActivite(
  id: string,
  siteId: string
): Promise<{ success: true } | { error: "global" } | { error: "linked" }> {
  const existingWithCount = await prisma.regleActivite.findFirst({
    where: { id },
    select: {
      id: true,
      siteId: true,
      _count: { select: { activites: true } },
    },
  });

  if (!existingWithCount) throw new Error("Regle introuvable.");

  // Regle globale — suppression interdite via API
  if (existingWithCount.siteId === null) {
    return { error: "global" };
  }

  // Regle d'un autre site — masquer comme introuvable (securite R8)
  if (existingWithCount.siteId !== siteId) {
    throw new Error("Regle introuvable.");
  }

  // Regle liee a des activites — suppression interdite
  if (existingWithCount._count.activites > 0) {
    return { error: "linked" };
  }

  // R4 : atomic deleteMany scoped to site
  const result = await prisma.regleActivite.deleteMany({
    where: { id, siteId },
  });

  if (result.count === 0) throw new Error("Regle introuvable.");

  return { success: true };
}

/**
 * Bascule l'etat isActive d'une regle (toggle).
 *
 * Lors de la reactivation d'une regle SEUIL_* (dont le firedOnce peut etre vrai),
 * remet egalement firedOnce a false pour permettre un nouveau declenchement.
 *
 * R4 : utilise updateMany avec condition atomique sur l'etat courant de isActive
 *      — jamais check-then-update non-atomique.
 *
 * @param id - ID de la regle
 * @returns { id, isActive } — nouvel etat de la regle
 */
export async function toggleRegleActivite(
  id: string,
  options?: { allowGlobal?: boolean }
): Promise<{ id: string; isActive: boolean }> {
  // Recuperer l'etat courant (lecture minimale)
  const current = await prisma.regleActivite.findFirst({
    where: { id },
    select: { id: true, isActive: true, typeDeclencheur: true, siteId: true },
  });

  if (!current) throw new Error("Regle introuvable.");

  if (current.siteId === null && !options?.allowGlobal) {
    throw new Error(
      "Les regles globales DKFarm ne peuvent pas etre modifiees. Creez une regle specifique a votre site."
    );
  }

  const newIsActive = !current.isActive;

  // Determiner si firedOnce doit etre remis a zero lors de la reactivation.
  // Concerne les regles de type seuil one-shot (R4 : condition declarative).
  const isSeuilType = SEUIL_TYPES_FIREDONCE.includes(
    current.typeDeclencheur as TypeDeclencheur
  );

  const shouldResetFiredOnce = newIsActive && isSeuilType;

  // R4 : updateMany atomique — la condition sur isActive courant evite les races
  const result = await prisma.regleActivite.updateMany({
    where: { id, isActive: current.isActive },
    data: {
      isActive: newIsActive,
      ...(shouldResetFiredOnce && { firedOnce: false }),
    },
  });

  if (result.count === 0) {
    // Etat a change entre la lecture et l'ecriture — relire et retourner l'etat reel
    const refreshed = await prisma.regleActivite.findFirst({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!refreshed) throw new Error("Regle introuvable.");
    return { id: refreshed.id, isActive: refreshed.isActive };
  }

  return { id, isActive: newIsActive };
}

/**
 * Remet firedOnce a false pour permettre un nouveau declenchement.
 *
 * Utilise pour les regles SEUIL_* dont firedOnce vaut true apres un premier
 * declenchement. Permet de relancer le moteur pour cette regle sans devoir
 * la desactiver puis la reactiver.
 *
 * R4 : updateMany avec condition atomique sur firedOnce=true — idempotent
 *      si firedOnce est deja false.
 *
 * @param id - ID de la regle
 * @returns { id, firedOnce: false }
 */
export async function resetFiredOnce(
  id: string
): Promise<{ id: string; firedOnce: false }> {
  // R4 : updateMany atomique — condition firedOnce=true evite une ecriture inutile
  const result = await prisma.regleActivite.updateMany({
    where: { id, firedOnce: true },
    data: { firedOnce: false },
  });

  if (result.count === 0) {
    // Soit la regle n'existe pas, soit firedOnce est deja false (idempotent)
    const existing = await prisma.regleActivite.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new Error("Regle introuvable.");
  }

  return { id, firedOnce: false };
}
