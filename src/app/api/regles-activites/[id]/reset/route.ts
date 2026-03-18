import { NextRequest, NextResponse } from "next/server";
import { getRegleActiviteById, resetFiredOnce } from "@/lib/queries/regles-activites";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeDeclencheur } from "@/types";
import { SEUIL_TYPES_FIREDONCE } from "@/lib/regles-activites-constants";

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
      return NextResponse.json(
        { error: "Regle d'activite introuvable." },
        { status: 404 }
      );
    }

    // Only SEUIL_* types have a meaningful firedOnce field
    if (!SEUIL_TYPES.includes(regle.typeDeclencheur as TypeDeclencheur)) {
      return NextResponse.json(
        {
          error: `La reinitialisation de firedOnce n'est applicable qu'aux regles de type SEUIL. Ce declencheur est : ${regle.typeDeclencheur}.`,
        },
        { status: 400 }
      );
    }

    const result = await resetFiredOnce(id);

    return NextResponse.json({ id: result.id, firedOnce: result.firedOnce });
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
    console.error("[POST /api/regles-activites/[id]/reset]", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la reinitialisation de firedOnce." },
      { status: 500 }
    );
  }
}
