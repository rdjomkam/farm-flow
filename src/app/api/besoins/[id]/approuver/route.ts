import { NextRequest, NextResponse } from "next/server";
import { approuverBesoins } from "@/lib/queries/besoins";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

/**
 * POST /api/besoins/[id]/approuver
 * Approuve une liste de besoins (SOUMISE → APPROUVEE).
 *
 * Permission : BESOINS_APPROUVER
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_APPROUVER
    );
    const { id } = await params;
    const listeBesoins = await approuverBesoins(
      id,
      auth.activeSiteId,
      auth.userId
    );
    return NextResponse.json(listeBesoins);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("Transition invalide")) {
      return apiError(400, message);
    }
    return apiError(500, "Erreur serveur.");
  }
}
