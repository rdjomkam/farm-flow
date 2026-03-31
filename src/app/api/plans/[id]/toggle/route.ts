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
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors du changement de statut du plan.");
  }
}
