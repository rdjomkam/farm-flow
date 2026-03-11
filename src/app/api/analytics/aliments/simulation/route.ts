import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getSimulationChangementAliment } from "@/lib/queries/analytics";

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
      return NextResponse.json(
        { status: 400, message: "La production cible doit etre un nombre positif." },
        { status: 400 }
      );
    }

    const simulation = await getSimulationChangementAliment(
      auth.activeSiteId,
      ancienProduitId,
      nouveauProduitId,
      productionCible
    );

    if (!simulation) {
      return NextResponse.json(
        { status: 404, message: "Un ou les deux produits aliments sont introuvables." },
        { status: 404 }
      );
    }

    return NextResponse.json(simulation);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la simulation." },
      { status: 500 }
    );
  }
}
