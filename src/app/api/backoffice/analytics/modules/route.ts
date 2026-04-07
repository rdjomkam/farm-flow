/**
 * GET /api/backoffice/analytics/modules — Distribution des modules actives par site.
 *
 * Guard : requireSuperAdmin (ADR-022)
 * Cache : Cache-Control: public, max-age=300 (5 minutes)
 *
 * Story C.3 — ADR-022 Backoffice
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { ForbiddenError } from "@/lib/permissions";
import { getModulesDistribution } from "@/lib/queries/admin-analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    // Guard super-admin
    await requireSuperAdmin(request);

    const distribution = await getModulesDistribution();

    return NextResponse.json({ distribution }, {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return handleApiError("GET /api/backoffice/analytics/modules", error, "Erreur serveur lors du calcul de la distribution des modules.");
  }
}
