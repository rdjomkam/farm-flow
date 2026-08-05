import { NextRequest, NextResponse } from "next/server";
import { listerPostesReferentielAdmin } from "@/lib/queries/previsions-postes-referentiel";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * GET /api/previsions/postes-referentiel/admin — liste TOUTES les entrees
 * `PosteReferentiel` (actives ET inactives) du site (ADR-053 §16.12, story
 * A.5, "Contrat des routes").
 *
 * Distincte de `GET /api/previsions/postes-referentiel` (ACTIFS seuls,
 * `PREVISIONS_VOIR`, consommee par l'onglet "Rechercher" du parcours de creation d'un
 * `PostePrevision`) — cette route sert l'ecran d'administration
 * `/previsions/postes-referentiel`, permission `PREVISIONS_PARAMETRER`
 * (paramétrage de structure, pas saisie de valeurs au jour le jour). Depuis R2,
 * `mapping-form-dialog.tsx` la consomme aussi (cibleType = POSTE_PREVISION) : meme
 * permission `PREVISIONS_PARAMETRER` requise pour ce parcours, donc aucun elargissement
 * d'acces induit par ce second consommateur.
 *
 * Site-scope strict (R8) : filtre `auth.activeSiteId`, jamais de `siteId`
 * dans la query string.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const data = await listerPostesReferentielAdmin(auth.activeSiteId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/postes-referentiel/admin",
      error,
      "Erreur serveur lors de la recuperation du referentiel des postes."
    );
  }
}
