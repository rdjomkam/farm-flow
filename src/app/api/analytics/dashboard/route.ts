import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getAnalyticsDashboard } from "@/lib/queries/analytics";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);

    const dashboard = await getAnalyticsDashboard(auth.activeSiteId);

    return NextResponse.json(dashboard);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du chargement du dashboard analytique." },
      { status: 500 }
    );
  }
}
