import { NextRequest, NextResponse } from "next/server";
import { getUnreadNotificationCount } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_VOIR);

    const count = await getUnreadNotificationCount(auth.activeSiteId, auth.userId);

    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError("GET /api/notifications/count", error, "Erreur serveur lors du comptage des notifications non lues.");
  }
}
