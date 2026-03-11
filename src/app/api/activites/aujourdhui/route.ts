import { NextRequest, NextResponse } from "next/server";
import { getActivitesAujourdhui } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);

    const activites = await getActivitesAujourdhui(auth.activeSiteId);

    return NextResponse.json({ activites, total: activites.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/activites/aujourdhui]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération des activités du jour." },
      { status: 500 }
    );
  }
}
