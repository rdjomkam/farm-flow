import { NextRequest, NextResponse } from "next/server";
import { getLotById, updateLot, deleteLot } from "@/lib/queries/lots-alevins";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateLotAlevinsDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.LOTS_ALEVINS_VOIR);
    const { id } = await params;

    const lot = await getLotById(id, auth.activeSiteId);
    if (!lot) {
      return apiError(404, "Lot d'alevins introuvable.");
    }

    return NextResponse.json(lot);
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/lots/[id]",
      error,
      "Erreur serveur lors de la recuperation du lot d'alevins."
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.LOTS_ALEVINS_GERER);
    const { id } = await params;
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // nombreActuel — optional, integer >= 0 if provided
    if (
      body.nombreActuel !== undefined &&
      body.nombreActuel !== null &&
      (typeof body.nombreActuel !== "number" ||
        !Number.isInteger(body.nombreActuel) ||
        body.nombreActuel < 0)
    ) {
      errors.push({
        field: "nombreActuel",
        message: "Le nombre actuel de poissons doit etre un entier positif ou nul.",
      });
    }

    // ageJours — optional, integer >= 0 if provided
    if (
      body.ageJours !== undefined &&
      body.ageJours !== null &&
      (typeof body.ageJours !== "number" ||
        !Number.isInteger(body.ageJours) ||
        body.ageJours < 0)
    ) {
      errors.push({
        field: "ageJours",
        message: "L'age en jours doit etre un entier positif ou nul.",
      });
    }

    // poidsMoyen — optional, number >= 0 if provided
    if (
      body.poidsMoyen !== undefined &&
      body.poidsMoyen !== null &&
      (typeof body.poidsMoyen !== "number" || body.poidsMoyen < 0)
    ) {
      errors.push({
        field: "poidsMoyen",
        message: "Le poids moyen doit etre un nombre positif ou nul.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: UpdateLotAlevinsDTO = {
      ...(body.code !== undefined && { code: body.code?.trim() }),
      ...(body.nombreActuel !== undefined && { nombreActuel: body.nombreActuel }),
      ...(body.ageJours !== undefined && { ageJours: body.ageJours }),
      ...(body.poidsMoyen !== undefined && { poidsMoyen: body.poidsMoyen }),
      ...(body.statut !== undefined && { statut: body.statut }),
      ...(body.bacId !== undefined && { bacId: body.bacId }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.nombreDeformesRetires !== undefined && {
        nombreDeformesRetires: body.nombreDeformesRetires,
      }),
      ...(body.poidsObjectifG !== undefined && {
        poidsObjectifG: body.poidsObjectifG,
      }),
    };

    const updated = await updateLot(id, auth.activeSiteId, dto);

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/lots/[id]",
      error,
      "Erreur serveur lors de la mise a jour du lot d'alevins."
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.LOTS_ALEVINS_GERER
    );
    const { id } = await params;

    await deleteLot(id, auth.activeSiteId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(
      "DELETE /api/reproduction/lots/[id]",
      error,
      "Erreur serveur lors de la suppression du lot d'alevins."
    );
  }
}
