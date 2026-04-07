import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getDetailAliment } from "@/lib/queries/analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ produitId: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const { produitId } = await params;

    const detail = await getDetailAliment(auth.activeSiteId, produitId);

    if (!detail) {
      return apiError(404, "Produit aliment introuvable.");
    }

    return NextResponse.json(detail);
  } catch (error) {
    return handleApiError("GET /api/analytics/aliments/[produitId]", error, "Erreur serveur lors du calcul du detail aliment.");
  }
}
