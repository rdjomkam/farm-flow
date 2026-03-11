import { NextRequest, NextResponse } from "next/server";
import { updateNotificationStatut } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutAlerte } from "@/types";

type Params = { params: Promise<{ id: string }> };

const STATUTS_VALIDES = Object.values(StatutAlerte) as string[];

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_VOIR);
    const { id } = await params;
    const body = await request.json();

    if (!body.statut || typeof body.statut !== "string") {
      return NextResponse.json(
        { status: 400, message: "Le statut est obligatoire." },
        { status: 400 }
      );
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
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    console.error("[PUT /api/notifications/[id]]", error);
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
