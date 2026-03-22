import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getNotifications } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutAlerte } from "@/types";

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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    console.error("[GET /api/notifications]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération des notifications." },
      { status: 500 }
    );
  }
}
