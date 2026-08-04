import { NextRequest, NextResponse } from "next/server";
import { activerScenario } from "@/lib/queries/previsions-scenarios";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/**
 * POST /api/previsions/scenarios/[id]/activer — transition de statut
 * BROUILLON -> ACTIF.
 *
 * Permission : PREVISIONS_GERER — meme raisonnement que
 * `scenarios/[id]/archiver` (transition de statut = edition de l'entite,
 * pas un acte de parametrage du contenu). Voir JSDoc de cette route soeur.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;

    const scenario = await activerScenario(id, auth.activeSiteId);
    return NextResponse.json(scenario);
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/activer",
      error,
      "Erreur serveur lors de l'activation du scenario.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
