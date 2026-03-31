import { NextRequest, NextResponse } from "next/server";
import { getPendingTaskCount } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);

    const count = await getPendingTaskCount(auth.activeSiteId, auth.userId);

    return NextResponse.json({ count });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/activites/mes-taches/count]", error);
    return apiError(500, "Erreur serveur.");
  }
}
