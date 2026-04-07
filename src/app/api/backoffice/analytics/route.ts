/**
 * GET /api/backoffice/analytics — KPIs consolides de toute la plateforme DKFarm.
 *
 * Guard : requireSuperAdmin (ADR-022)
 * Cache : Cache-Control: public, max-age=300 (5 minutes)
 *
 * Story C.3 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { ForbiddenError } from "@/lib/permissions";
import { getPlatformKPIs } from "@/lib/queries/admin-analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    // Guard super-admin
    await requireSuperAdmin(request);

    // Recuperer les KPIs
    const kpis = await getPlatformKPIs();

    return NextResponse.json(kpis, {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return handleApiError("GET /api/backoffice/analytics", error, "Erreur serveur lors du calcul des KPIs plateforme.");
  }
}
