import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getNotifications } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutAlerte } from "@/types";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/notifications]", error);
    return apiError(500, "Erreur serveur lors de la récupération des notifications.");
  }
}
