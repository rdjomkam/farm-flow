import { NextRequest, NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_VOIR);

    await markAllNotificationsRead(auth.activeSiteId, auth.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[POST /api/notifications/mark-all-read]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du marquage des notifications." },
      { status: 500 }
    );
  }
}
