import { NextRequest, NextResponse } from "next/server";
import { updateArrivageGroupe } from "@/lib/queries/arrivages";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateArrivageGroupeDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { ConservationError } from "@/lib/errors";

type Params = { params: Promise<{ id: string; groupeId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_MODIFIER);
    const { groupeId } = await params;
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    if (!body.raison || typeof body.raison !== "string" || body.raison.trim().length < 3) {
      errors.push({ field: "raison", message: "raison obligatoire (min 3 caractères)" });
    }

    if (body.nombrePoissons !== undefined && (typeof body.nombrePoissons !== "number" || body.nombrePoissons <= 0)) {
      errors.push({ field: "nombrePoissons", message: "nombrePoissons doit être > 0" });
    }

    if (body.poidsMoyen !== undefined && (typeof body.poidsMoyen !== "number" || body.poidsMoyen <= 0)) {
      errors.push({ field: "poidsMoyen", message: "poidsMoyen doit être > 0" });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: UpdateArrivageGroupeDTO = {
      raison: body.raison.trim(),
      ...(body.nombrePoissons !== undefined && { nombrePoissons: body.nombrePoissons }),
      ...(body.poidsMoyen !== undefined && { poidsMoyen: body.poidsMoyen }),
      ...(body.destinationBacId !== undefined && { destinationBacId: body.destinationBacId }),
    };

    const result = await updateArrivageGroupe(auth.activeSiteId, auth.userId, groupeId, dto);
    return NextResponse.json(result);
  } catch (error) {
    // GT.3 — ConservationError du guard de conservation (verifyAssignationInvariant) :
    // sans ce catch dédié, l'erreur tombait dans le fallback générique de
    // handleApiError (500 opaque), le message ne contenant ni "Conservation"
    // ni les autres motifs du statusMap ci-dessous.
    if (error instanceof ConservationError) {
      return NextResponse.json(
        {
          status: 409,
          message: error.message,
          details: {
            expected: error.sourcesTotal,
            actual: error.saisiTotal,
            ecart: error.ecart,
            bacId: error.bacId,
          },
        },
        { status: 409 }
      );
    }
    return handleApiError("PATCH /api/arrivages/[id]/groupes/[groupeId]", error, "Erreur lors de la modification.", {
      statusMap: [
        { match: ["raison", "Conservation"], status: 409 },
        { match: ["introuvable", "EN_COURS", "pré-grossissement"], status: 400 },
      ],
    });
  }
}
