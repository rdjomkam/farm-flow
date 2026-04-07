import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getComparaisonBacs } from "@/lib/queries/analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { searchParams } = new URL(request.url);
    const vagueId = searchParams.get("vagueId");

    if (!vagueId) {
      return apiError(400, "Le parametre 'vagueId' est obligatoire.");
    }

    const comparaison = await getComparaisonBacs(auth.activeSiteId, vagueId);

    if (!comparaison) {
      return apiError(404, "Vague introuvable.");
    }

    return NextResponse.json(comparaison);
  } catch (error) {
    return handleApiError("GET /api/analytics/bacs", error, "Erreur serveur lors du calcul des analytiques.");
  }
}
