/**
 * src/app/api/previsions/_shared.ts
 *
 * Helpers partages par toutes les routes du module Previsions (Sprint PR2,
 * story PR2.2).
 *
 * ---------------------------------------------------------------------------
 * Historique — ERR-165 (corrige, sprint PR3, story PR3.2)
 * ---------------------------------------------------------------------------
 * Ce fichier portait auparavant `PREVISIONS_STATUS_MAP`, un statusMap PARTAGE
 * de 7 entrees `{ match: string, status: number }` couplant le statut HTTP a
 * une SOUS-CHAINE d'un message utilisateur (ecrit volontairement sans
 * accents pour ne pas casser le matching) — signale par trois reviews
 * consecutives (ERR-165, `docs/knowledge/ERRORS-AND-FIXES.md`). Tous les
 * sites de levee (`src/lib/previsions/validation.ts`,
 * `src/lib/previsions/route-orchestration.ts`,
 * `src/lib/queries/previsions-scenarios.ts`,
 * `src/lib/queries/previsions-vagues.ts`,
 * `src/lib/queries/previsions-aliments.ts`,
 * `src/lib/queries/previsions-charges.ts`) levent desormais une
 * `BusinessRuleError(message, status)` (`src/lib/errors.ts`), interceptee
 * par `handleApiError` (`src/lib/api-utils.ts`) via `error.status` — le
 * statut HTTP est une DONNEE portee par l'erreur, plus jamais deduit du
 * texte du message (ADR-053 §15.4). `PREVISIONS_STATUS_MAP` est supprime ;
 * plus aucune route de ce module ne passe de `statusMap` a `handleApiError`.
 */
import { z } from "zod";
import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/types";
import { apiError } from "@/lib/api-utils";

/**
 * parseBody — valide un payload JSON contre un schema zod (convention
 * retenue pour ce module, voir rapport de cloture PR2.2 pour la
 * justification), et renvoie soit les donnees typees, soit une NextResponse
 * 400 prete a etre retournee telle quelle par la route appelante.
 *
 * Usage :
 *   const parsed = parseBody(mySchema, await request.json());
 *   if (parsed.error) return parsed.error;
 *   const data = parsed.data;
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { data: T; error?: undefined } | { data?: undefined; error: NextResponse<ApiErrorResponse> } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: apiError(400, "Erreurs de validation.", {
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(racine)",
          message: issue.message,
        })),
      }),
    };
  }
  return { data: result.data };
}
