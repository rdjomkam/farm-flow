import { NextRequest, NextResponse } from "next/server";
import { getScenarioById, deleteScenario } from "@/lib/queries/previsions-scenarios";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

/** GET /api/previsions/scenarios/[id] — detail d'un scenario (parametres + paliers). PREVISIONS_VOIR. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const scenario = await getScenarioById(id, auth.activeSiteId);
    if (!scenario) {
      return apiError(404, "Scenario introuvable.");
    }

    return NextResponse.json(scenario);
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]",
      error,
      "Erreur serveur lors de la recuperation du scenario."
    );
  }
}

/** DELETE /api/previsions/scenarios/[id] — supprime un scenario et toutes ses donnees. PREVISIONS_SUPPRIMER. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_SUPPRIMER);
    const { id } = await params;

    const scenario = await getScenarioById(id, auth.activeSiteId);
    if (!scenario) {
      return apiError(404, "Scenario introuvable.");
    }

    await deleteScenario(id, auth.activeSiteId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(
      "DELETE /api/previsions/scenarios/[id]",
      error,
      "Erreur serveur lors de la suppression du scenario."
    );
  }
}
