import { NextRequest, NextResponse } from "next/server";
import { desactiverPosteReferentiel } from "@/lib/queries/previsions-postes-referentiel";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * POST /api/previsions/postes-referentiel/[id]/desactiver — desactive une
 * entree `PosteReferentiel` (ADR-053 §16.12, story A.5, "Arbitrage 2").
 *
 * Bloque uniquement la CREATION de nouveaux rattachements — n'affecte JAMAIS
 * les `PostePrevision`/`MappingRapprochement` deja lies. Idempotent :
 * desactiver une entree deja desactivee retourne 200, jamais 409.
 *
 * Permission : PREVISIONS_PARAMETRER. Site-scope strict (R8), meme pattern
 * 404 (jamais 403) qu'ailleurs dans ce module.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;

    const referentiel = await desactiverPosteReferentiel(id, auth.activeSiteId);
    return NextResponse.json(referentiel);
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/postes-referentiel/[id]/desactiver",
      error,
      "Erreur serveur lors de la desactivation du poste referentiel."
    );
  }
}
