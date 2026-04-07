import { NextRequest, NextResponse } from "next/server";
import { toggleRegleActivite } from "@/lib/queries/regles-activites";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/regles-activites/[id]/toggle
 * Bascule l'etat isActive d'une regle d'activite.
 *
 * Lors de la reactivation d'une regle SEUIL_*, remet egalement firedOnce a false
 * pour permettre un nouveau declenchement (comportement gere dans toggleRegleActivite).
 *
 * Retourne { id, isActive } avec le nouvel etat.
 * Permission : GERER_REGLES_ACTIVITES
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.GERER_REGLES_ACTIVITES);
    const { id } = await params;

    const result = await toggleRegleActivite(id, {
      allowGlobal: auth.permissions.includes(Permission.GERER_REGLES_GLOBALES),
    });

    return NextResponse.json({ id: result.id, isActive: result.isActive });
  } catch (error) {
    return handleApiError("PATCH /api/regles-activites/[id]/toggle", error, "Erreur serveur lors du basculement de la regle d'activite.", {
      statusMap: [
        { match: "globales DKFarm", status: 403 },
      ],
    });
  }
}
