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
    // ADR-053 §16.12 (story A.5, correctif review) — un `.refine()` peut
    // attacher un code machine stable a une violation de forme via le
    // troisieme parametre zod `params: { code: "..." }` (ex.
    // POSTE_REFERENTIEL_CHAMP_REQUIS / POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS,
    // `previsions.schema.ts`). C'est un mecanisme GENERIQUE, pas un cas
    // particulier de cette route : tout `.refine()` du projet qui a besoin
    // d'exposer un `code` machine (au lieu d'un simple message francais)
    // peut poser `params: { code }`, et `parseBody` le propage automatiquement
    // jusqu'a la reponse HTTP 400 — sans jamais dupliquer la logique metier
    // (la query reste seule source de verite pour distinguer les codes fins,
    // ce filet de securite au niveau forme du payload ne fait que relayer le
    // code que le schema porte deja explicitement).
    const codedIssue = result.error.issues.find(
      (issue): issue is z.core.$ZodIssueCustom & { params: { code: string } } =>
        issue.code === "custom" && typeof issue.params?.code === "string"
    );
    return {
      error: apiError(400, "Erreurs de validation.", {
        ...(codedIssue ? { code: codedIssue.params.code } : {}),
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(racine)",
          message: issue.message,
        })),
      }),
    };
  }
  return { data: result.data };
}
