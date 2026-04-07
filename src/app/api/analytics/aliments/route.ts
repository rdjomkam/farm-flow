import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getComparaisonAliments } from "@/lib/queries/analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const { searchParams } = new URL(request.url);
    const fournisseurId = searchParams.get("fournisseurId") ?? undefined;

    const comparaison = await getComparaisonAliments(auth.activeSiteId, {
      fournisseurId,
    });

    return NextResponse.json(comparaison);
  } catch (error) {
    return handleApiError("GET /api/analytics/aliments", error, "Erreur serveur lors du calcul des analytiques aliments.");
  }
}
