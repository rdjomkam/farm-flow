import { NextRequest, NextResponse } from "next/server";
import { activerScenarioAvecSnapshot } from "@/lib/queries/previsions-snapshot-budget";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * POST /api/previsions/scenarios/[id]/activer — transition de statut
 * BROUILLON -> ACTIF, et gel du budget initial (ADR-053 §15.2, amendement
 * Sprint PR3, story PR3.3) dans LA MEME transaction (R4) :
 * `activerScenarioAvecSnapshot` cree `SnapshotBudgetInitial` et fait passer
 * `ScenarioPrevision.statut` a `ACTIF` atomiquement — jamais l'un sans
 * l'autre. Une deuxieme activation du meme scenario est refusee (409, un
 * scenario ne s'active qu'une seule fois dans son cycle de vie).
 *
 * Permission : PREVISIONS_GERER — meme raisonnement que
 * `scenarios/[id]/archiver` (transition de statut = edition de l'entite,
 * pas un acte de parametrage du contenu). Voir JSDoc de cette route soeur.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;

    const scenario = await activerScenarioAvecSnapshot(id, auth.activeSiteId);
    return NextResponse.json(scenario);
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/activer",
      error,
      "Erreur serveur lors de l'activation du scenario."
    );
  }
}
