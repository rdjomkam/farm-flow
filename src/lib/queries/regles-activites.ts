import { prisma } from "@/lib/db";
import { TypeDeclencheur, TypeActivite, PhaseElevage } from "@/types";
import type { CreateRegleActiviteDTO, UpdateRegleActiviteDTO, RegleActiviteFilters } from "@/types";

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
 * Liste les regles d'activite d'un site + les regles globales (siteId=null).
 *
 * R8 : inclut WHERE (siteId = X OR siteId IS NULL) pour couvrir les regles globales.
 */
export async function getReglesActivites(
  siteId: string,
  filters?: RegleActiviteFilters
) {
  return prisma.regleActivite.findMany({
    where: {
      OR: [{ siteId }, { siteId: null }],
      ...(filters?.typeActivite && { typeActivite: filters.typeActivite }),
      ...(filters?.typeDeclencheur && {
        typeDeclencheur: filters.typeDeclencheur,
      }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
    },
    include: {
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      _count: { select: { activites: true } },
    },
    orderBy: [{ isActive: "desc" }, { priorite: "asc" }, { nom: "asc" }],
  });
}

/**
 * Recupere une regle par ID.
 *
 * Retourne la regle si elle appartient au site OU si c'est une regle globale
 * (siteId=null). R8 : acces protege par la verification du siteId ou global.
 */
export async function getRegleActiviteById(id: string, siteId: string) {
  return prisma.regleActivite.findFirst({
    where: {
      id,
      OR: [{ siteId }, { siteId: null }],
    },
    include: {
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
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
 * Validation EC-3.5 : phaseMin <= phaseMax.
 * R8 : le siteId est toujours positionne sur la regle creee.
 */
export async function createRegleActivite(
  siteId: string,
  userId: string,
  data: CreateRegleActiviteDTO
) {
  const phaseMin = data.phasesCibles?.[0] as PhaseElevage | undefined;
  const phaseMax = data.phasesCibles?.[data.phasesCibles.length - 1] as
    | PhaseElevage
    | undefined;
  validatePhaseRange(phaseMin ?? null, phaseMax ?? null);

  return prisma.regleActivite.create({
    data: {
      nom: data.nom,
      description: data.description ?? null,
      typeActivite: data.typeActivite,
      typeDeclencheur: data.typeDeclencheur,
      conditionValeur: data.seuilDeclencheur ?? null,
      conditionValeur2: null,
      phaseMin: phaseMin ?? null,
      phaseMax: phaseMax ?? null,
      intervalleJours: data.intervalleJours ?? null,
      titreTemplate: data.titreTemplate,
      descriptionTemplate: null,
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
 * Met a jour une regle d'activite appartenant au site.
 *
 * Interdiction de modifier une regle globale (siteId=null) via cette fonction.
 * R4 : updateMany avec condition atomique sur siteId (non-nullable).
 * Validation EC-3.5 : phaseMin <= phaseMax.
 */
export async function updateRegleActivite(
  id: string,
  siteId: string,
  data: UpdateRegleActiviteDTO
) {
  // Refuse modification of global rules (siteId=null) for non-admin callers
  const existing = await prisma.regleActivite.findFirst({
    where: { id },
    select: { id: true, siteId: true, phaseMin: true, phaseMax: true },
  });

  if (!existing) throw new Error("Regle introuvable.");

  if (existing.siteId === null) {
    throw new Error(
      "Les regles globales DKFarm ne peuvent pas etre modifiees. Creez une regle specifique a votre site."
    );
  }

  if (existing.siteId !== siteId) {
    throw new Error("Regle introuvable.");
  }

  // Resolve target phaseMin / phaseMax for EC-3.5 validation
  const phaseMin = data.phasesCibles?.[0] as PhaseElevage | undefined;
  const phaseMax = data.phasesCibles?.[data.phasesCibles.length - 1] as
    | PhaseElevage
    | undefined;

  // Only validate if both ends of the range are provided
  if (phaseMin !== undefined && phaseMax !== undefined) {
    validatePhaseRange(phaseMin, phaseMax);
  }

  // R4 : atomic updateMany scoped to site
  const result = await prisma.regleActivite.updateMany({
    where: { id, siteId },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.description !== undefined && {
        description: data.description ?? null,
      }),
      ...(data.typeActivite !== undefined && {
        typeActivite: data.typeActivite,
      }),
      ...(data.typeDeclencheur !== undefined && {
        typeDeclencheur: data.typeDeclencheur,
      }),
      ...(data.seuilDeclencheur !== undefined && {
        conditionValeur: data.seuilDeclencheur,
      }),
      ...(phaseMin !== undefined && { phaseMin }),
      ...(phaseMax !== undefined && { phaseMax }),
      ...(data.intervalleJours !== undefined && {
        intervalleJours: data.intervalleJours,
      }),
      ...(data.titreTemplate !== undefined && {
        titreTemplate: data.titreTemplate,
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
    where: { id, siteId },
    include: {
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
  });
}

/**
 * Supprime une regle d'activite.
 *
 * Regles metier :
 * - Une regle globale (siteId=null) ne peut jamais etre supprimee via cette API.
 * - R4 : deleteMany atomique avec condition sur siteId.
 */
export async function deleteRegleActivite(id: string, siteId: string) {
  // Check if rule is global before attempting delete (R4)
  const existing = await prisma.regleActivite.findFirst({
    where: { id },
    select: { id: true, siteId: true },
  });

  if (!existing) throw new Error("Regle introuvable.");

  if (existing.siteId === null) {
    throw new Error(
      "Les regles globales DKFarm ne peuvent pas etre supprimees."
    );
  }

  if (existing.siteId !== siteId) {
    throw new Error("Regle introuvable.");
  }

  // R4 : atomic deleteMany scoped to site
  const result = await prisma.regleActivite.deleteMany({
    where: { id, siteId },
  });

  if (result.count === 0) throw new Error("Regle introuvable.");

  return { success: true };
}
