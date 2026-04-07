import { NextRequest, NextResponse } from "next/server";
import { getActivitesAujourdhui } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);

    const activites = await getActivitesAujourdhui(auth.activeSiteId);

    return NextResponse.json({ activites, total: activites.length });
  } catch (error) {
    return handleApiError("GET /api/activites/aujourdhui", error, "Erreur serveur lors de la récupération des activités du jour.");
  }
}
