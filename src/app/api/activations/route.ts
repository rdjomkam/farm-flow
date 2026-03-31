import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutActivation } from "@/types";
import { getPackActivations } from "@/lib/queries/packs";
import { apiError } from "@/lib/api-utils";

/**
 * GET /api/activations
 * Liste toutes les activations de packs du site actif (site vendeur DKFarm).
 * Permission : ACTIVER_PACKS
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ACTIVER_PACKS);

    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");
    const packId = searchParams.get("packId");
    const clientSiteId = searchParams.get("clientSiteId");

    const validStatuts = Object.values(StatutActivation) as string[];
    const filters = {
      ...(statut && validStatuts.includes(statut) && { statut: statut as StatutActivation }),
      ...(packId && { packId }),
      ...(clientSiteId && { clientSiteId }),
    };

    const activations = await getPackActivations(auth.activeSiteId, filters);
    return NextResponse.json({ activations, total: activations.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des activations.");
  }
}
