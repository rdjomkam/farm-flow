/**
 * Queries Prisma — PlanAbonnement (Sprint 30)
 *
 * R2 : importer les enums depuis @/types
 * R4 : opérations atomiques via updateMany avec condition
 * R8 : PlanAbonnement est global (pas de siteId) — exception documentée dans ADR-020
 */
import { prisma } from "@/lib/db";
import type { CreatePlanAbonnementDTO, UpdatePlanAbonnementDTO } from "@/types";

/** Liste les plans d'abonnement actifs et publics (page tarifs) */
export async function getPlansAbonnements(includeInactif = false) {
  return prisma.planAbonnement.findMany({
    where: includeInactif ? {} : { isActif: true, isPublic: true },
    include: {
      _count: {
        select: {
          abonnements: {
            where: { statut: { in: ["ACTIF", "EN_GRACE"] } },
          },
        },
      },
    },
    orderBy: { typePlan: "asc" },
  });
}

/** Récupère un plan par ID avec le nombre d'abonnés actifs */
export async function getPlanAbonnementById(id: string) {
  return prisma.planAbonnement.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          abonnements: {
            where: { statut: { in: ["ACTIF", "EN_GRACE"] } },
          },
        },
      },
    },
  });
}

/** Crée un plan d'abonnement (ADMIN uniquement) */
export async function createPlanAbonnement(data: CreatePlanAbonnementDTO) {
  return prisma.planAbonnement.create({
    data: {
      nom: data.nom,
      typePlan: data.typePlan,
      description: data.description ?? null,
      prixMensuel: data.prixMensuel ?? null,
      prixTrimestriel: data.prixTrimestriel ?? null,
      prixAnnuel: data.prixAnnuel ?? null,
      limitesSites: data.limitesSites ?? 1,
      limitesBacs: data.limitesBacs ?? 3,
      limitesVagues: data.limitesVagues ?? 1,
      limitesIngFermes: data.limitesIngFermes ?? null,
      isActif: data.isActif ?? true,
      isPublic: data.isPublic ?? true,
    },
  });
}

/** Met à jour partiellement un plan d'abonnement */
export async function updatePlanAbonnement(
  id: string,
  data: UpdatePlanAbonnementDTO
) {
  return prisma.planAbonnement.update({
    where: { id },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.prixMensuel !== undefined && { prixMensuel: data.prixMensuel }),
      ...(data.prixTrimestriel !== undefined && {
        prixTrimestriel: data.prixTrimestriel,
      }),
      ...(data.prixAnnuel !== undefined && { prixAnnuel: data.prixAnnuel }),
      ...(data.limitesSites !== undefined && {
        limitesSites: data.limitesSites,
      }),
      ...(data.limitesBacs !== undefined && { limitesBacs: data.limitesBacs }),
      ...(data.limitesVagues !== undefined && {
        limitesVagues: data.limitesVagues,
      }),
      ...(data.limitesIngFermes !== undefined && {
        limitesIngFermes: data.limitesIngFermes,
      }),
      ...(data.isActif !== undefined && { isActif: data.isActif }),
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
    },
  });
}

/**
 * Toggle l'état actif d'un plan — R4 : atomique via updateMany avec condition.
 * Retourne le nombre de plans modifiés (0 si non trouvé, 1 si trouvé).
 */
export async function togglePlanAbonnement(id: string) {
  const plan = await prisma.planAbonnement.findUnique({
    where: { id },
    select: { isActif: true },
  });
  if (!plan) return { count: 0 };

  const result = await prisma.planAbonnement.updateMany({
    where: { id, isActif: plan.isActif },
    data: { isActif: !plan.isActif },
  });
  return result;
}
