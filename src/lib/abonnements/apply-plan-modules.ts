/**
 * src/lib/abonnements/apply-plan-modules.ts
 *
 * Applique les modules d'un plan à un site lors de l'activation d'un abonnement.
 *
 * Story 43.5 — Sprint 43
 * ADR-022 Sprint B : PLATFORM_MODULES supprime, tous les modules sont site-level.
 * R2 : enums importés depuis @/types
 * R4 : updateMany atomique via Prisma transaction
 * R8 : siteId obligatoire
 */
import { prisma } from "@/lib/db";
import type { SiteModule } from "@/types";

/**
 * Applique les modules du plan au site en remplaçant enabledModules.
 *
 * @param siteId - ID du site (R8)
 * @param planId - ID du PlanAbonnement à appliquer
 */
export async function applyPlanModules(siteId: string, planId: string): Promise<void> {
  const plan = await prisma.planAbonnement.findUnique({
    where: { id: planId },
    select: { modulesInclus: true, typePlan: true },
  });

  if (!plan) {
    throw new Error(`[applyPlanModules] Plan ${planId} introuvable`);
  }

  const siteModules = plan.modulesInclus as SiteModule[];

  await prisma.site.update({
    where: { id: siteId },
    data: { enabledModules: siteModules },
  });

  console.log(
    `[applyPlanModules] Site ${siteId} — plan ${plan.typePlan} (${planId}) — modules: [${siteModules.join(", ")}]`
  );
}

/**
 * Applique les modules du plan dans une transaction Prisma existante.
 * Utiliser cette variante quand applyPlanModules doit être inclus dans un $transaction.
 *
 * @param tx - Instance Prisma transactionnelle
 * @param siteId - ID du site (R8)
 * @param planId - ID du PlanAbonnement à appliquer
 */
export async function applyPlanModulesTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  siteId: string,
  planId: string
): Promise<void> {
  const plan = await tx.planAbonnement.findUnique({
    where: { id: planId },
    select: { modulesInclus: true, typePlan: true },
  });

  if (!plan) {
    throw new Error(`[applyPlanModulesTx] Plan ${planId} introuvable`);
  }

  const siteModules = plan.modulesInclus as SiteModule[];

  await tx.site.update({
    where: { id: siteId },
    data: { enabledModules: siteModules },
  });

  console.log(
    `[applyPlanModulesTx] Site ${siteId} — plan ${plan.typePlan} (${planId}) — modules: [${siteModules.join(", ")}]`
  );
}
