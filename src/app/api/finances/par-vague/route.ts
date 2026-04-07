import { NextRequest, NextResponse } from "next/server";
import { getRentabiliteParVague } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);

    const rentabilite = await getRentabiliteParVague(auth.activeSiteId);

    return NextResponse.json(rentabilite);
  } catch (error) {
    return handleApiError("GET /api/finances/par-vague", error, "Erreur serveur lors du calcul de la rentabilité par vague.");
  }
}
