import { NextRequest, NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_VOIR);

    await markAllNotificationsRead(auth.activeSiteId, auth.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[POST /api/notifications/mark-all-read]", error);
    return apiError(500, "Erreur serveur lors du marquage des notifications.");
  }
}
