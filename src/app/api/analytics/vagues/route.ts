import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getComparaisonVagues } from "@/lib/queries/analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { searchParams } = new URL(request.url);
    const vagueIdsParam = searchParams.get("vagueIds");

    if (!vagueIdsParam) {
      return apiError(400, "Le parametre 'vagueIds' est obligatoire (IDs separes par des virgules).");
    }

    const vagueIds = vagueIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (vagueIds.length < 2) {
      return apiError(400, "Au moins 2 vagues sont requises pour la comparaison.");
    }

    if (vagueIds.length > 4) {
      return apiError(400, "La comparaison est limitee a 4 vagues maximum.");
    }

    const comparaison = await getComparaisonVagues(auth.activeSiteId, vagueIds);

    return NextResponse.json(comparaison);
  } catch (error) {
    return handleApiError("GET /api/analytics/vagues", error, "Erreur serveur lors de la comparaison des vagues.");
  }
}
