/**
 * src/lib/abonnements/apply-plan-modules.ts
 *
 * Applique les modules d'un plan à un site lors de l'activation d'un abonnement.
 *
 * Story 43.5 — Sprint 43
 * R2 : enums importés depuis @/types
 * R4 : updateMany atomique via Prisma transaction
 * R8 : siteId obligatoire
 *
 * Note : les modules platform-level (ABONNEMENTS, COMMISSIONS, REMISES)
 * sont gérés par isModuleActive() dans la couche auth — ne pas les inclure dans enabledModules.
 */
import { prisma } from "@/lib/db";
import { PLATFORM_MODULES } from "@/lib/site-modules-config";
import type { SiteModule } from "@/types";

/**
 * Applique les modules du plan au site en remplaçant enabledModules.
 * Filtre les modules platform-level avant l'écriture.
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

  // Filtrer les modules platform-level — jamais stockés dans enabledModules (gérés par isModuleActive())
  const platformModuleValues = PLATFORM_MODULES.map((m) => m.value);
  const siteModules = (plan.modulesInclus as SiteModule[]).filter(
    (m) => !platformModuleValues.includes(m)
  );

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

  const platformModuleValues = PLATFORM_MODULES.map((m) => m.value);
  const siteModules = (plan.modulesInclus as SiteModule[]).filter(
    (m) => !platformModuleValues.includes(m)
  );

  await tx.site.update({
    where: { id: siteId },
    data: { enabledModules: siteModules },
  });

  console.log(
    `[applyPlanModulesTx] Site ${siteId} — plan ${plan.typePlan} (${planId}) — modules: [${siteModules.join(", ")}]`
  );
}
