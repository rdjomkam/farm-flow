import { NextRequest, NextResponse } from "next/server";
import { getBacsAvecRelevesPourVague } from "@/lib/queries/bacs";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

/**
 * GET /api/bacs/by-vague-releves?vagueId={vagueId}
 *
 * Retourne les bacs distincts ayant au moins un releve pour la vague demandee.
 * Inclut les bacs orphelins (Bac.vagueId = null) avec des releves historiques.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const { searchParams } = new URL(request.url);
    const vagueId = searchParams.get("vagueId");

    if (!vagueId) {
      return apiError(400, "Le parametre vagueId est obligatoire.");
    }

    const bacs = await getBacsAvecRelevesPourVague(auth.activeSiteId, vagueId);

    return NextResponse.json({ data: bacs });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des bacs par releves.");
  }
}
