import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { creerBonLivraisonRectificatif } from "@/lib/queries/bons-livraison";
import { creerBonLivraisonRectificatifSchema } from "@/lib/validation/bon-livraison";
import { apiError, handleApiError } from "@/lib/api-utils";
import { ConservationError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/bons-livraison/[id]/rectifier
 * Cree un bon de livraison rectificatif a partir d'un BL SIGNE (Sprint BF
 * phase 2, Story BF.7a). L'id de la route est le BL d'origine a rectifier.
 * Permission : BONS_LIVRAISON_RECTIFIER
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BONS_LIVRAISON_RECTIFIER
    );
    const { id } = await params;

    const body = await request.json();
    const parseResult = creerBonLivraisonRectificatifSchema.safeParse(body);

    if (!parseResult.success) {
      return apiError(400, "Donnees invalides.", {
        errors: parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }

    if (parseResult.data.bonLivraisonOrigineId !== id) {
      return apiError(
        400,
        "L'identifiant du bon de livraison a rectifier ne correspond pas à la route."
      );
    }

    const bonLivraison = await creerBonLivraisonRectificatif(
      auth.activeSiteId,
      auth.userId,
      id,
      { motifRectification: parseResult.data.motifRectification }
    );

    return NextResponse.json(bonLivraison, { status: 201 });
  } catch (error) {
    // GT.3 — ConservationError du guard de conservation, si jamais declenchee
    // en amont (non attendu a la creation, mais defensif comme les autres
    // routes GT.3 — la signature du rectificatif, elle, peut la declencher).
    if (error instanceof ConservationError) {
      return NextResponse.json(
        {
          status: 409,
          message: error.message,
          details: {
            expected: error.sourcesTotal,
            actual: error.saisiTotal,
            ecart: error.ecart,
            bacId: error.bacId,
          },
        },
        { status: 409 }
      );
    }
    return handleApiError(
      "POST /api/bons-livraison/[id]/rectifier",
      error,
      "Erreur serveur lors de la creation du bon de livraison rectificatif.",
      {
        statusMap: [
          { match: "introuvable", status: 404 },
          { match: "déjà été rectifié", status: 409 },
          { match: "déjà rectifié", status: 409 },
          { match: "clôturée", status: 409 },
          { match: "signé", status: 409 },
          { match: "livrée", status: 409 },
        ],
      }
    );
  }
}
