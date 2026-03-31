import { NextRequest, NextResponse } from "next/server";
import { getActiviteById } from "@/lib/queries";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/activites/[id]/instructions
 *
 * Retourne les instructions détaillées résolues (Markdown) d'une activité.
 * Les instructions sont stockées dans le champ `instructionsDetaillees` avec
 * les placeholders déjà résolus par le moteur de règles (Sprint 21).
 *
 * Réponse :
 *   { instructions: string | null, titre: string, conseilIA: string | null }
 *
 * R8 : filtre siteId pour garantir l'appartenance au site courant.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);
    const { id } = await params;

    const activite = await getActiviteById(auth.activeSiteId, id);
    if (!activite) {
      return apiError(404, "Activité introuvable.");
    }

    return NextResponse.json({
      id: activite.id,
      titre: activite.titre,
      // instructionsDetaillees contient le Markdown résolu par le moteur de règles.
      // null pour les activités créées manuellement sans template.
      instructions: activite.instructionsDetaillees ?? null,
      conseilIA: activite.conseilIA ?? null,
      produitRecommandeId: activite.produitRecommandeId ?? null,
      quantiteRecommandee: activite.quantiteRecommandee ?? null,
      priorite: activite.priorite,
      phaseElevage: activite.phaseElevage ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/activites/[id]/instructions]", error);
    return apiError(500, "Erreur serveur lors de la récupération des instructions.");
  }
}
