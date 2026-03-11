import { NextRequest, NextResponse } from "next/server";
import { getResumeFinancier } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/finances/resume]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul du résumé financier." },
      { status: 500 }
    );
  }
}
