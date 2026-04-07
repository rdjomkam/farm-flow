import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getIndicateursBac } from "@/lib/queries/analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bacId: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { bacId } = await params;
    const { searchParams } = new URL(request.url);
    const vagueId = searchParams.get("vagueId");

    if (!vagueId) {
      return apiError(400, "Le parametre 'vagueId' est obligatoire.");
    }

    const indicateurs = await getIndicateursBac(auth.activeSiteId, vagueId, bacId);

    if (!indicateurs) {
      return apiError(404, "Bac ou vague introuvable.");
    }

    return NextResponse.json(indicateurs);
  } catch (error) {
    return handleApiError("GET /api/analytics/bacs/[bacId]", error, "Erreur serveur lors du calcul des indicateurs du bac.");
  }
}
