import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getAnalyticsDashboard } from "@/lib/queries/analytics";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);

    const dashboard = await getAnalyticsDashboard(auth.activeSiteId);

    return NextResponse.json(dashboard);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors du chargement du dashboard analytique.");
  }
}
