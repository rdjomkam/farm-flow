import { NextRequest, NextResponse } from "next/server";
import { toggleRegleActivite } from "@/lib/queries/regles-activites";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, (error as Error).message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, (error as Error).message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("globales DKFarm")) {
      return apiError(403, message);
    }
    console.error("[PATCH /api/regles-activites/[id]/toggle]", error);
    return apiError(500, "Erreur serveur lors du basculement de la regle d'activite.");
  }
}
