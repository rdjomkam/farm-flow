import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getDetailAliment } from "@/lib/queries/analytics";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors du calcul du detail aliment.");
  }
}
