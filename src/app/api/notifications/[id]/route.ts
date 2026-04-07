import { NextRequest, NextResponse } from "next/server";
import { updateNotificationStatut } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutAlerte } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const STATUTS_VALIDES = Object.values(StatutAlerte) as string[];

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_VOIR);
    const { id } = await params;
    const body = await request.json();

    if (!body.statut || typeof body.statut !== "string") {
      return apiError(400, "Le statut est obligatoire.");
    }

    if (!STATUTS_VALIDES.includes(body.statut)) {
      return NextResponse.json(
        {
          status: 400,
          message: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const notification = await updateNotificationStatut(auth.activeSiteId, id, body.statut);

    return NextResponse.json(notification);
  } catch (error) {
    return handleApiError("PUT /api/notifications/[id]", error, "Erreur serveur.");
  }
}
