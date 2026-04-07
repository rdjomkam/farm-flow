import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getHistoriqueBac } from "@/lib/queries/analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bacId: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { bacId } = await params;

    const historique = await getHistoriqueBac(auth.activeSiteId, bacId);

    if (!historique) {
      return apiError(404, "Bac introuvable.");
    }

    return NextResponse.json(historique);
  } catch (error) {
    return handleApiError("GET /api/analytics/bacs/[bacId]/historique", error, "Erreur serveur lors du calcul de l'historique du bac.");
  }
}
