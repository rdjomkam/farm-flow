import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutActivation } from "@/types";
import { getPackActivations } from "@/lib/queries/packs";
import { apiError, handleApiError } from "@/lib/api-utils";

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
    return handleApiError("GET /api/activations", error, "Erreur serveur lors de la recuperation des activations.");
  }
}
