import { NextRequest, NextResponse } from "next/server";
import { toggleRegleActivite } from "@/lib/queries/regles-activites";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

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
      return NextResponse.json({ error: (error as Error).message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("globales DKFarm")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[PATCH /api/regles-activites/[id]/toggle]", error);
    return NextResponse.json(
      { error: "Erreur serveur lors du basculement de la regle d'activite." },
      { status: 500 }
    );
  }
}
