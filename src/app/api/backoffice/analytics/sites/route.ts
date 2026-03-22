/**
 * GET /api/backoffice/analytics/sites — Evolution du nombre de sites dans le temps.
 *
 * Guard : requireSuperAdmin (ADR-022)
 * Query params : period : "7d" | "30d" | "90d" | "12m" (defaut "30d")
 * Cache : Cache-Control: public, max-age=300 (5 minutes)
 *
 * Story C.3 — ADR-022 Backoffice
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { getSitesGrowth } from "@/lib/queries/admin-analytics";

const VALID_PERIODS = ["7d", "30d", "90d", "12m"] as const;
type Period = (typeof VALID_PERIODS)[number];

export async function GET(request: NextRequest) {
  try {
    // Guard super-admin
    await requireSuperAdmin(request);

    // Parser le query param period
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const period: Period =
      periodParam && VALID_PERIODS.includes(periodParam as Period)
        ? (periodParam as Period)
        : "30d";

    const result = await getSitesGrowth(period);

    return NextResponse.json(result, {
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
    console.error("[GET /api/backoffice/analytics/sites]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul de l'evolution des sites." },
      { status: 500 }
    );
  }
}
