import { NextRequest, NextResponse } from "next/server";
import { sortirLot } from "@/lib/queries/lots-alevins";
import { requirePermission } from "@/lib/permissions";
import { Permission, DestinationLot } from "@/types";
import type { SortieLotDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_DESTINATIONS = Object.values(DestinationLot);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_MODIFIER);
    const { id } = await params;
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // destinationSortie — required, must be a valid DestinationLot
    if (!body.destinationSortie || typeof body.destinationSortie !== "string") {
      errors.push({
        field: "destinationSortie",
        message: "La destination de sortie est obligatoire.",
      });
    } else if (
      !VALID_DESTINATIONS.includes(body.destinationSortie as DestinationLot)
    ) {
      errors.push({
        field: "destinationSortie",
        message: `Destination invalide. Valeurs acceptees : ${VALID_DESTINATIONS.join(", ")}.`,
      });
    }

    // dateTransfert — required, must be a valid ISO date
    if (
      !body.dateTransfert ||
      typeof body.dateTransfert !== "string" ||
      isNaN(Date.parse(body.dateTransfert))
    ) {
      errors.push({
        field: "dateTransfert",
        message: "La date de transfert est obligatoire (format ISO 8601).",
      });
    }

    // vagueDestinationId — required if destinationSortie is TRANSFERT_GROSSISSEMENT
    if (
      body.destinationSortie === DestinationLot.TRANSFERT_GROSSISSEMENT &&
      (!body.vagueDestinationId || typeof body.vagueDestinationId !== "string")
    ) {
      errors.push({
        field: "vagueDestinationId",
        message:
          "L'identifiant de la vague de destination est obligatoire pour un transfert vers grossissement.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: SortieLotDTO = {
      destinationSortie: body.destinationSortie as DestinationLot,
      dateTransfert: body.dateTransfert,
      vagueDestinationId: body.vagueDestinationId ?? undefined,
      notes: body.notes?.trim() ?? undefined,
    };

    await sortirLot(id, auth.activeSiteId, dto);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/lots/[id]/sortie",
      error,
      "Erreur serveur lors de l'enregistrement de la sortie du lot d'alevins."
    );
  }
}
