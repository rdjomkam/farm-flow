import { NextRequest, NextResponse } from "next/server";
import { archiverScenario } from "@/lib/queries/previsions-scenarios";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/**
 * POST /api/previsions/scenarios/[id]/archiver — transition de statut
 * BROUILLON|ACTIF -> ARCHIVE.
 *
 * Permission : PREVISIONS_GERER. Non couverte explicitement par le tableau
 * ADR-053 section 6 (qui liste "creer/editer scenarios" sous GERER, sans
 * mentionner les transitions de statut) — decision explicite de ce sprint,
 * par analogie : changer le statut d'un ScenarioPrevision est une forme
 * d'edition de l'entite elle-meme, pas un acte de parametrage du contenu
 * (PREVISIONS_PARAMETRER reste reserve a ParametresPrevision/PostePrevision/
 * PalierRemise/AlimentPrevision). A confirmer si un raisonnement different
 * devait prevaloir (cf. pre-analyse PR2.2, section 2).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;

    const scenario = await archiverScenario(id, auth.activeSiteId);
    return NextResponse.json(scenario);
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/archiver",
      error,
      "Erreur serveur lors de l'archivage du scenario.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
