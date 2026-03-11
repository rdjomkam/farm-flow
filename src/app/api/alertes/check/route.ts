import { NextRequest, NextResponse } from "next/server";
import { verifierAlertes } from "@/lib/alertes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_CONFIGURER);

    await verifierAlertes(auth.activeSiteId, auth.userId);

    return NextResponse.json({
      success: true,
      message: "Vérification des alertes effectuée",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/alertes/check]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la vérification des alertes." },
      { status: 500 }
    );
  }
}
