/**
 * src/app/api/remises/[id]/toggle/route.ts
 *
 * PATCH /api/remises/[id]/toggle  — activer/désactiver une remise (auth + REMISES_GERER)
 *
 * R4 : toggle via toggleRemise (updateMany — atomique)
 *
 * Story 35.1 — Sprint 35
 * R2 : enums importés depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { getRemiseById, toggleRemise } from "@/lib/queries/remises";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, Permission.REMISES_GERER);
    const { id } = await params;

    // Récupérer l'état actuel
    const existing = await getRemiseById(id);
    if (!existing) {
      return apiError(404, "Remise introuvable.");
    }

    // Toggle atomique — R4 : updateMany pour garantir atomicité
    const newIsActif = !existing.isActif;
    await toggleRemise(id, newIsActif);

    // Retourner l'état mis à jour
    const updated = await getRemiseById(id);
    return NextResponse.json({
      remise: updated,
      isActif: newIsActif,
      message: newIsActif ? "Remise activée." : "Remise désactivée.",
    });
  } catch (error) {
    return handleApiError("PATCH /api/remises/[id]/toggle", error, "Erreur serveur lors du toggle de la remise.");
  }
}
