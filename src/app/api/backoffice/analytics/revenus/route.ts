/**
 * GET /api/backoffice/analytics/revenus — Decomposition mensuelle des revenus confirmes.
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
import { getRevenueAnalytics } from "@/lib/queries/admin-analytics";
import { apiError } from "@/lib/api-utils";

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

    const result = await getRevenueAnalytics(period);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/backoffice/analytics/revenus]", error);
    return apiError(500, "Erreur serveur lors du calcul des revenus.");
  }
}
