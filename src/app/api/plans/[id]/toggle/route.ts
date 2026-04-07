/**
 * src/app/api/plans/[id]/toggle/route.ts
 *
 * PATCH /api/plans/[id]/toggle — activer/désactiver un plan
 *
 * Story 32.1 — Sprint 32
 * R2 : enums importés depuis @/types
 * R4 : atomique via togglePlanAbonnement (updateMany avec condition dans la query)
 */
import { NextRequest, NextResponse } from "next/server";
import { togglePlanAbonnement } from "@/lib/queries/plans-abonnements";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requirePermission(request, Permission.PLANS_GERER);

    // R4 : atomique via updateMany avec condition dans la query
    const result = await togglePlanAbonnement(id);

    if (result.count === 0) {
      return apiError(404, "Plan introuvable.");
    }

    // count === -1 : désactivation bloquée par des abonnés actifs
    if (result.count === -1) {
      const nb = "abonnesActifs" in result ? result.abonnesActifs : 0;
      return NextResponse.json(
        {
          status: 409,
          message: `Impossible de désactiver un plan avec des abonnés actifs.`,
          abonnesActifs: nb,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: "Statut du plan mis à jour.",
      isActif: "isActif" in result ? result.isActif : undefined,
    });
  } catch (error) {
    return handleApiError("PATCH /api/plans/[id]/toggle", error, "Erreur serveur lors du changement de statut du plan.");
  }
}
