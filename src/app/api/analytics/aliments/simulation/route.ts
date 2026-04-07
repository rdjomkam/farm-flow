import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getSimulationChangementAliment } from "@/lib/queries/analytics";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const body = await request.json();

    const { ancienProduitId, nouveauProduitId, productionCible } = body;

    if (!ancienProduitId || !nouveauProduitId || !productionCible) {
      return NextResponse.json(
        {
          status: 400,
          message: "Les champs 'ancienProduitId', 'nouveauProduitId' et 'productionCible' sont obligatoires.",
        },
        { status: 400 }
      );
    }

    if (typeof productionCible !== "number" || productionCible <= 0) {
      return apiError(400, "La production cible doit etre un nombre positif.");
    }

    const simulation = await getSimulationChangementAliment(
      auth.activeSiteId,
      ancienProduitId,
      nouveauProduitId,
      productionCible
    );

    if (!simulation) {
      return apiError(404, "Un ou les deux produits aliments sont introuvables.");
    }

    return NextResponse.json(simulation);
  } catch (error) {
    return handleApiError("POST /api/analytics/aliments/simulation", error, "Erreur serveur lors de la simulation.");
  }
}
