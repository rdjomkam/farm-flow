import { NextRequest, NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_VOIR);

    await markAllNotificationsRead(auth.activeSiteId, auth.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError("POST /api/notifications/mark-all-read", error, "Erreur serveur lors du marquage des notifications.");
  }
}
