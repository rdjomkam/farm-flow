import { NextRequest, NextResponse } from "next/server";
import { getRentabiliteParVague } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);

    const rentabilite = await getRentabiliteParVague(auth.activeSiteId);

    return NextResponse.json(rentabilite);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/finances/par-vague]", error);
    return apiError(500, "Erreur serveur lors du calcul de la rentabilité par vague.");
  }
}
