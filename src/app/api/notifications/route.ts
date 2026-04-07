import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getNotifications } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutAlerte } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const STATUTS_VALIDES = Object.values(StatutAlerte) as string[];

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_VOIR);
    const { searchParams } = new URL(request.url);

    const statutParam = searchParams.get("statut");

    if (statutParam && !STATUTS_VALIDES.includes(statutParam)) {
      return NextResponse.json(
        {
          status: 400,
          message: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const notifications = await getNotifications(
      auth.activeSiteId,
      auth.userId,
      statutParam ? { statut: statutParam as StatutAlerte } : undefined
    );

    return cachedJson({ notifications, total: notifications.length }, "fast");
  } catch (error) {
    return handleApiError("GET /api/notifications", error, "Erreur serveur lors de la récupération des notifications.");
  }
}
