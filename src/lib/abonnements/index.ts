/**
 * src/lib/abonnements/index.ts
 *
 * Barrel export — lib/abonnements
 *
 * Sprint 46 — Story 46.3
 */

export {
  getSubscriptionStatus,
  getSubscriptionStatusForSite,
  isSubscriptionValid,
  isReadOnlyMode,
  isBlocked,
} from "./check-subscription";

export type { SubscriptionStatus } from "./check-subscription";

export { invalidateSubscriptionCaches } from "./invalidate-caches";

export {
  normaliseLimite,
  isQuotaAtteint,
  getQuotasUsage,
  getQuotasUsageWithCounts,
  getQuotaSites,
} from "./check-quotas";

export type { QuotaRessource, QuotasUsage, QuotaSites } from "./check-quotas";

export { applyPlanModules, applyPlanModulesTx } from "./apply-plan-modules";

export { createAbonnementFromPack } from "./create-from-pack";

export {
  calculerCreditRestant,
  calculerPrixPlan,
  calculerDeltaUpgrade,
} from "./prorata";

export type { DeltaUpgrade } from "./prorata";
