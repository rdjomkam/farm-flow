import { NextRequest, NextResponse } from "next/server";
import { getScenarioById } from "@/lib/queries/previsions-scenarios";
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
