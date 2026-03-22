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
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { getModulesDistribution } from "@/lib/queries/admin-analytics";

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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    console.error("[GET /api/backoffice/analytics/modules]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul de la distribution des modules." },
      { status: 500 }
    );
  }
}
