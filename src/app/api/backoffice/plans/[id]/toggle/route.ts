/**
 * src/app/api/backoffice/plans/[id]/toggle/route.ts
 *
 * PATCH /api/backoffice/plans/[id]/toggle — activer/désactiver un plan
 *
 * Guard : requireSuperAdmin (isSuperAdmin vérifié depuis DB, ADR-022)
 * Les plans sont des entités platform-globales sans siteId.
 *
 * R2 : enums importés depuis @/types
 * R4 : atomique via togglePlanAbonnement (updateMany avec condition dans la query)
 */
import { NextRequest, NextResponse } from "next/server";
import { togglePlanAbonnement } from "@/lib/queries/plans-abonnements";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(request);
    const { id } = await params;

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
          message: "Impossible de desactiver un plan avec des abonnes actifs.",
          abonnesActifs: nb,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: "Statut du plan mis a jour.",
      isActif: "isActif" in result ? result.isActif : undefined,
    });
  } catch (error) {
    return handleApiError("PATCH /api/backoffice/plans/[id]/toggle", error, "Erreur serveur lors du changement de statut du plan.");
  }
}
