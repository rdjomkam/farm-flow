/**
 * src/app/api/previsions/_shared.ts
 *
 * Helpers partages par toutes les routes du module Previsions (Sprint PR2,
 * story PR2.2).
 *
 * ---------------------------------------------------------------------------
 * Mapping HTTP des validations bloquantes du §8 de l'ADR-053
 * ---------------------------------------------------------------------------
 * `validerSommeRepartitionMoisAliment`/`validerPaliersRemiseCroissants`
 * (moteur, `src/lib/previsions/validation.ts`) et la garde
 * `assertEntierColonneInt` (queries PR2.1) levent toutes des `Error` nues,
 * dont le message ne matche AUCUN des patterns codes en dur de
 * `handleApiError` — sans intervention, ces trois violations de saisie
 * utilisateur tomberaient en 500 (erreur serveur) au lieu d'un 4xx.
 *
 * Choix retenu ici (option "statusMap par route", recommandee par la
 * pre-analyse PR2.2 section 1, alternative au retypage de l'Error dans le
 * moteur) : un statusMap PARTAGE, passe explicitement a `handleApiError` par
 * CHAQUE route de ce module qui peut declencher l'une de ces trois erreurs —
 * cela evite de toucher `src/lib/previsions/validation.ts` (le moteur est
 * intouchable sauf necessite prouvee, et cette necessite n'est pas prouvee
 * ici : un mapping HTTP a la route suffit et est strictement local a la
 * couche route, jamais au moteur).
 *
 * - "doit valoir 100" -> 422 (somme des pourcentages de repartition != 100%)
 * - "seuils strictement croissants" -> 422 (paliers de remise non croissants)
 * - "doit etre un entier (colonne Prisma Int)" -> 400 (garde assertEntierColonneInt)
 * - "sacsParTonneStandard non configure" -> 422 (route-orchestration.ts, GAP 1 —
 *   ADR-053 amendement Sprint PR2 §11 : donnee de configuration manquante, pas une
 *   erreur serveur — l'utilisateur doit saisir le coefficient avant de recalculer)
 * - "ParametresPrevision absent" -> 422 (story PR2bis.2, generation du plan —
 *   ParametresPrevision est une relation optionnelle, cf. ADR-053 §3.3 : donnee
 *   de configuration manquante, pas une erreur serveur)
 * - "part(s) d'approvisionnement" / "sans tailleGranule" -> 422 (ADR-053 §12,
 *   amendement Sprint PR2-quater : violations de saisie utilisateur, pas des
 *   erreurs serveur — cf. validerSommeApprovisionnementArticles (validation.ts)
 *   et copierAlimentsPrevisionDepuisProduits (previsions-scenarios.ts))
 *
 * NB (bugfix Sprint PR2-quater, rapport @tester PR2q.4 §6) : la malformation
 * du payload `repartition` de `addAlimentArticlePrevision` ("La repartition
 * doit contenir exactement un element sans articleId...") n'a PAS ete ajoutee
 * ici sous forme de nouvelle entree statusMap. Ce mecanisme grossit sans
 * typage (reserve n°6, docs/reviews/review-sprint-PR2-bis.md) et la review
 * recommandait de typer en `ValidationError` avant toute story qui retouche
 * `validation.ts` — c'est precisement ce sprint. `previsions-aliments.ts`
 * leve desormais une `ValidationError` (src/lib/errors.ts, deja geree par
 * `handleApiError` en amont du statusMap) pour ce cas precis. Perimetre
 * volontairement etroit : seule cette garde de coherence de la couche query
 * a ete retypee, pas les erreurs du moteur (`validation.ts`) — les retyper
 * toutes aurait touche un fichier protege par le filet de securite recette
 * (1270 tests) pour un gain hors mandat de ce bugfix ; voir le message au PM.
 */
import { z } from "zod";
import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@/types";
import { apiError, type HandleApiErrorOptions } from "@/lib/api-utils";

export const PREVISIONS_STATUS_MAP: NonNullable<HandleApiErrorOptions["statusMap"]> = [
  { match: "doit valoir 100", status: 422 },
  { match: "seuils strictement croissants", status: 422 },
  /*
   * Doublon d'`ordre` entre deux paliers — 400, PAS 422, decision tranchee
   * (reserve M3, review PR2sept.4).
   *
   * Ce refus a DEUX sites de levee pour un seul et meme refus metier :
   *  1. le `.superRefine` de `replacePaliersRemiseSchema` (zod), qui tranche
   *     AVANT que la query soit atteinte sur le chemin HTTP -> 400 avec un
   *     `errors: [{ field: "paliers.<i>.ordre" }]` restitue au champ fautif ;
   *  2. la garde metier de `replacePaliersRemise` (query), filet pour les
   *     appelants NON-HTTP (et si la garde zod venait a etre relachee), qui
   *     leve une `Error` nue — sans l'entree ci-dessous elle sortirait en 500.
   * Un meme refus ne doit pas avoir deux codes selon le chemin emprunte : on
   * aligne donc le filet sur le code du chemin reel (400, validation de
   * payload), et non sur le 422 initialement declare, qui n'etait de toute
   * facon jamais observable.
   *
   * AVERTISSEMENT (fragilite assumee, cf. reserve M3) : ce mapping repose sur
   * une SOUS-CHAINE d'un message destine a l'utilisateur, ecrit sans accents.
   * Accentuer ce message dans `src/lib/queries/previsions-scenarios.ts`
   * (correction legitime dans une UI francaise) romprait silencieusement le
   * lien et ferait retomber ce cas en 500. Toute retouche du message doit
   * donc etre repercutee ici. La correction de fond (erreur metier typee
   * portant son propre statut, du type `BusinessRuleError { status }`, qui
   * supprimerait ce couplage par chaine pour TOUTES les entrees de cette map)
   * est signalee au PM et hors perimetre de ce correctif.
   */
  { match: "meme ordre d'evaluation", status: 400 },
  { match: "doit etre un entier (colonne Prisma Int)", status: 400 },
  { match: "sacsParTonneStandard non configure", status: 422 },
  { match: "ParametresPrevision absent", status: 422 },
  { match: "sans tailleGranule", status: 422 },
];

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
