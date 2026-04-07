import { NextRequest, NextResponse } from "next/server";
import { updateConfigAlerte, deleteConfigAlerte } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_CONFIGURER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (body.seuilValeur !== undefined) {
      if (typeof body.seuilValeur !== "number" || body.seuilValeur < 0) {
        errors.push({ field: "seuilValeur", message: "Le seuil de valeur doit être un nombre >= 0." });
      }
    }

    if (body.seuilPourcentage !== undefined) {
      if (
        typeof body.seuilPourcentage !== "number" ||
        body.seuilPourcentage < 0 ||
        body.seuilPourcentage > 100
      ) {
        errors.push({
          field: "seuilPourcentage",
          message: "Le seuil en pourcentage doit être un nombre entre 0 et 100.",
        });
      }
    }

    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      errors.push({ field: "enabled", message: "Le champ enabled doit être un booléen." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const config = await updateConfigAlerte(auth.activeSiteId, id, {
      seuilValeur: body.seuilValeur,
      seuilPourcentage: body.seuilPourcentage,
      enabled: body.enabled,
    });

    return NextResponse.json(config);
  } catch (error) {
    return handleApiError("PUT /api/alertes/config/[id]", error, "Erreur serveur.");
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALERTES_CONFIGURER);
    const { id } = await params;

    await deleteConfigAlerte(auth.activeSiteId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError("DELETE /api/alertes/config/[id]", error, "Erreur serveur.");
  }
}
