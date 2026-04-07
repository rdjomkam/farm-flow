import { NextRequest, NextResponse } from "next/server";
import { getResumeFinancier } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

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
    return handleApiError("GET /api/finances/resume", error, "Erreur serveur lors du calcul du résumé financier.");
  }
}
