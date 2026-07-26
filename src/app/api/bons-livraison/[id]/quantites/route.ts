import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { enregistrerQuantitesBonLivraison } from "@/lib/queries/bons-livraison";
import { enregistrerQuantitesBonLivraisonSchema } from "@/lib/validation/bon-livraison";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/bons-livraison/[id]/quantites
 *
 * Enregistre les quantites reellement livrees d'un bon de livraison, avant
 * signature (ecran 1 du flux — Sprint BF). Passe le BL de BROUILLON a
 * EN_ATTENTE_SIGNATURE ; re-editable tant que non signe.
 * Permission : VENTES_MODIFIER
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_MODIFIER);
    const { id } = await params;

    const body = await request.json();
    const parseResult = enregistrerQuantitesBonLivraisonSchema.safeParse(body);

    if (!parseResult.success) {
      return apiError(400, "Donnees invalides.", {
        errors: parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }

    const bonLivraison = await enregistrerQuantitesBonLivraison(
      auth.activeSiteId,
      auth.userId,
      id,
      parseResult.data
    );

    return NextResponse.json(bonLivraison);
  } catch (error) {
    return handleApiError(
      "PUT /api/bons-livraison/[id]/quantites",
      error,
      "Erreur serveur lors de l'enregistrement des quantites livrees.",
      {
        statusMap: [
          { match: "introuvable", status: 404 },
          { match: ["signé", "signe", "préparation", "preparation"], status: 409 },
        ],
      }
    );
  }
}
