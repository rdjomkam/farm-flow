import { NextRequest, NextResponse } from "next/server";
import { getRegleActiviteById, resetFiredOnce } from "@/lib/queries/regles-activites";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeDeclencheur } from "@/types";
import { SEUIL_TYPES_FIREDONCE } from "@/lib/regles-activites-constants";
import { apiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const SEUIL_TYPES = SEUIL_TYPES_FIREDONCE;

/**
 * POST /api/regles-activites/[id]/reset
 * Remet firedOnce a false pour permettre un nouveau declenchement.
 *
 * Uniquement applicable aux regles de type seuil one-shot :
 * SEUIL_POIDS, SEUIL_QUALITE, SEUIL_MORTALITE, FCR_ELEVE, STOCK_BAS.
 * Retourne 400 si le type de declencheur n'est pas un SEUIL.
 *
 * Retourne { id, firedOnce: false } apres reinitialisation.
 * Permission : GERER_REGLES_ACTIVITES
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.GERER_REGLES_ACTIVITES);
    const { id } = await params;

    // Fetch the rule to verify it exists and check its typeDeclencheur
    const regle = await getRegleActiviteById(id, auth.activeSiteId);
    if (!regle) {
      return apiError(404, "Regle d'activite introuvable.");
    }

    // Only SEUIL_* types have a meaningful firedOnce field
    if (!SEUIL_TYPES.includes(regle.typeDeclencheur as TypeDeclencheur)) {
      return apiError(400, `La reinitialisation de firedOnce n'est applicable qu'aux regles de type SEUIL. Ce declencheur est : ${regle.typeDeclencheur}.`);
    }

    const result = await resetFiredOnce(id);

    return NextResponse.json({ id: result.id, firedOnce: result.firedOnce });
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
    console.error("[POST /api/regles-activites/[id]/reset]", error);
    return apiError(500, "Erreur serveur lors de la reinitialisation de firedOnce.");
  }
}
