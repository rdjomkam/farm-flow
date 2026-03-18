/**
 * context-resolver.ts — Resolveur de chemins dans le contexte d'evaluation.
 *
 * Resout un chemin pointe (ex: "indicateurs.biomasse") dans le RuleEvaluationContext.
 * Whitelist stricte des chemins racines autorises pour la securite.
 */

import type { RuleEvaluationContext } from "@/types/activity-engine";

// Chemins racines autorises
const ALLOWED_ROOTS = new Set([
  "indicateurs",
  "vague",
  "stock",
  "joursEcoules",
  "semaine",
  "phase",
  "derniersReleves",
  "configElevage",
  "bac",
]);

// Mapping: type slug used in source paths → TypeReleve enum value in context
const TYPE_RELEVE_MAP: Record<string, string> = {
  qualite_eau: "QUALITE_EAU",
  biometrie: "BIOMETRIE",
  alimentation: "ALIMENTATION",
  mortalite: "MORTALITE",
  comptage: "COMPTAGE",
  observation: "OBSERVATION",
};

/**
 * Resout un chemin pointe dans le contexte d'evaluation.
 *
 * Exemples:
 *   "indicateurs.biomasse" → ctx.indicateurs.biomasse
 *   "joursEcoules" → ctx.joursEcoules
 *   "stock.0.quantiteActuelle" → ctx.stock[0].quantiteActuelle
 *   "vague.code" → ctx.vague.code
 *   "derniersReleves.alimentation.quantiteAliment"
 *       → find first entry in ctx.derniersReleves where typeReleve === "ALIMENTATION",
 *         then read .quantiteAliment
 *
 * @returns La valeur resolue (number | string) ou null si introuvable/non autorise
 */
export function resolveContextPath(
  path: string,
  ctx: RuleEvaluationContext
): number | string | null {
  if (!path || typeof path !== "string") return null;

  const segments = path.split(".");
  if (segments.length === 0) return null;

  // Check root is whitelisted
  const root = segments[0];
  if (!ALLOWED_ROOTS.has(root)) return null;

  // Special handling: derniersReleves.<typeSlug>.<field>
  // Finds the most recent relevé of the given type instead of using a raw index
  if (root === "derniersReleves" && segments.length >= 3) {
    const typeSlug = segments[1];
    const typeReleve = TYPE_RELEVE_MAP[typeSlug];
    if (typeReleve) {
      const releves = ctx.derniersReleves;
      if (!Array.isArray(releves)) return null;

      const match = releves.find(
        (r) =>
          r != null &&
          typeof r === "object" &&
          (r as Record<string, unknown>).typeReleve === typeReleve
      );
      if (!match) return null;

      // Traverse remaining segments (after root and typeSlug)
      let current: unknown = match;
      for (let i = 2; i < segments.length; i++) {
        if (current == null || typeof current !== "object") return null;
        current = (current as Record<string, unknown>)[segments[i]];
      }

      if (typeof current === "number") return current;
      if (typeof current === "string") return current;
      return null;
    }
  }

  // Generic traversal (supports numeric array indices like "stock.0.field")
  let current: unknown = ctx;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return null;

    // Support array index access (e.g., "stock.0.quantiteActuelle")
    const index = Number(segment);
    if (Array.isArray(current) && !isNaN(index)) {
      current = (current as unknown[])[index];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  // Return only number or string values
  if (typeof current === "number") return current;
  if (typeof current === "string") return current;
  return null;
}
