import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getAnalyticsDashboard } from "@/lib/queries/analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);

    const dashboard = await getAnalyticsDashboard(auth.activeSiteId);

    return NextResponse.json(dashboard);
  } catch (error) {
    return handleApiError("GET /api/analytics/dashboard", error, "Erreur serveur lors du chargement du dashboard analytique.");
  }
}
