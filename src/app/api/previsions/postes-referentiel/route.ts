import { NextRequest, NextResponse } from "next/server";
import { listerPostesReferentielActifs } from "@/lib/queries/previsions-postes-referentiel";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * GET /api/previsions/postes-referentiel — liste les entrees `PosteReferentiel`
 * ACTIVES du site (ADR-053 §16, story A.4 : correction structurelle du
 * mapping `POSTE_PREVISION`, ERR-179/ERR-180).
 *
 * Site-scope (R8), PAS scenario-scope : consommee par l'onglet "Rechercher" du parcours de
 * creation d'un `PostePrevision` (ADR-053 §16.12) — la liste des postes du site, stable dans
 * le temps, remplace la liste scenario-scopee (`GET /scenarios/[id]/postes`) qui etait la
 * source du defaut ERR-179 (une cible qui devient orpheline des qu'un nouveau scenario est
 * cree ou l'ancien supprime). Depuis R2, `mapping-form-dialog.tsx` ne consomme plus cette
 * route : il consomme desormais `GET /api/previsions/postes-referentiel/admin`.
 *
 * Permission : PREVISIONS_VOIR (lecture).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const data = await listerPostesReferentielActifs(auth.activeSiteId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/postes-referentiel",
      error,
      "Erreur serveur lors de la recuperation du referentiel des postes."
    );
  }
}
