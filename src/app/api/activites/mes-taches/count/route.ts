import { NextRequest, NextResponse } from "next/server";
import { getPendingTaskCount } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);

    const count = await getPendingTaskCount(auth.activeSiteId, auth.userId);

    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError("GET /api/activites/mes-taches/count", error, "Erreur serveur.");
  }
}
