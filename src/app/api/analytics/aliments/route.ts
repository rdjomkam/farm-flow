import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getComparaisonAliments } from "@/lib/queries/analytics";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors du calcul des analytiques aliments.");
  }
}
