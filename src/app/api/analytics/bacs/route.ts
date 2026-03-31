import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getComparaisonBacs } from "@/lib/queries/analytics";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors du calcul des analytiques.");
  }
}
