import { NextRequest, NextResponse } from "next/server";
import { getResumeFinancier } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.FINANCES_VOIR);
    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;

    const periode =
      dateFrom && dateTo
        ? { dateFrom, dateTo }
        : undefined;

    const resume = await getResumeFinancier(auth.activeSiteId, periode);

    return NextResponse.json(resume);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/finances/resume]", error);
    return apiError(500, "Erreur serveur lors du calcul du résumé financier.");
  }
}
