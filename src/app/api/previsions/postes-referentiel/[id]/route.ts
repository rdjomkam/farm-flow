import { NextRequest, NextResponse } from "next/server";
import { renommerPosteReferentiel } from "@/lib/queries/previsions-postes-referentiel";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { renommerPosteReferentielSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * PATCH /api/previsions/postes-referentiel/[id] — renomme une entree
 * `PosteReferentiel` (ADR-053 §16.12, story A.5, "Contrat des routes").
 *
 * `libelle` SEULEMENT — `code` reste FIGE (Arbitrage 1) : la route rejette
 * explicitement tout champ `code` dans le body (`renommerPosteReferentielSchema`,
 * `.strict()`), plutot que de l'ignorer silencieusement.
 *
 * Permission : PREVISIONS_PARAMETRER. Site-scope strict (R8) : une entree
 * d'un autre site est INTROUVABLE (404), jamais INTERDITE (403).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(renommerPosteReferentielSchema, body);
    if (parsed.error) return parsed.error;

    const referentiel = await renommerPosteReferentiel(id, auth.activeSiteId, parsed.data.libelle);
    return NextResponse.json(referentiel);
  } catch (error) {
    return handleApiError(
      "PATCH /api/previsions/postes-referentiel/[id]",
      error,
      "Erreur serveur lors du renommage du poste referentiel."
    );
  }
}
