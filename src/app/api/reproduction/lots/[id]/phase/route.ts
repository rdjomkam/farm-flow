import { NextRequest, NextResponse } from "next/server";
import { changeLotPhase } from "@/lib/queries/lots-alevins";
import { requirePermission } from "@/lib/permissions";
import { Permission, PhaseLot } from "@/types";
import type { ChangePhaseLotDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_PHASES = Object.values(PhaseLot);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.LOTS_ALEVINS_GERER);
    const { id } = await params;
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // phase — required, must be valid PhaseLot
    if (!body.phase || typeof body.phase !== "string") {
      errors.push({
        field: "phase",
        message: "La phase est obligatoire.",
      });
    } else if (!VALID_PHASES.includes(body.phase as PhaseLot)) {
      errors.push({
        field: "phase",
        message: `Phase invalide. Valeurs acceptees : ${VALID_PHASES.join(", ")}.`,
      });
    }

    // dateDebutPhase — optional, must be valid ISO date if provided
    if (
      body.dateDebutPhase !== undefined &&
      body.dateDebutPhase !== null &&
      (typeof body.dateDebutPhase !== "string" ||
        isNaN(Date.parse(body.dateDebutPhase)))
    ) {
      errors.push({
        field: "dateDebutPhase",
        message: "La date de debut de phase est invalide (format ISO 8601 requis).",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: ChangePhaseLotDTO = {
      phase: body.phase as PhaseLot,
      dateDebutPhase: body.dateDebutPhase ?? undefined,
      bacId: body.bacId ?? undefined,
    };

    await changeLotPhase(id, auth.activeSiteId, dto);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/lots/[id]/phase",
      error,
      "Erreur serveur lors du changement de phase du lot d'alevins."
    );
  }
}
