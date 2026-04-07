import { NextRequest, NextResponse } from "next/server";
import { verifierAlertes } from "@/lib/alertes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_CONFIGURER);

    await verifierAlertes(auth.activeSiteId, auth.userId);

    return NextResponse.json({
      success: true,
      message: "Vérification des alertes effectuée",
    });
  } catch (error) {
    return handleApiError("GET /api/alertes/check", error, "Erreur serveur lors de la vérification des alertes.");
  }
}
