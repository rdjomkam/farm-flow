/**
 * index.ts — Barrel export du moteur d'activites.
 *
 * Point d'entree unique pour les consommateurs du moteur.
 *
 * Usage :
 * ```ts
 * import { buildEvaluationContext, evaluateRules, generateActivities } from "@/lib/activity-engine";
 * ```
 */

export { buildEvaluationContext } from "./context";
export { evaluateRules } from "./evaluator";
export { resolveTemplate, buildPlaceholders } from "./template-engine";
export { calculerQuantiteAliment } from "./feeding";
export { generateActivities } from "./generator";
export type { FeedingRecommendation } from "./feeding";
export type { GeneratorResult } from "./generator";
