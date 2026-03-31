import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getHistoriqueBac } from "@/lib/queries/analytics";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors du calcul de l'historique du bac.");
  }
}
