import { NextRequest, NextResponse } from "next/server";
import { verifierAlertes } from "@/lib/alertes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

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
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/alertes/check]", error);
    return apiError(500, "Erreur serveur lors de la vérification des alertes.");
  }
}
