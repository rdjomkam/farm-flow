import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { signerBonLivraison } from "@/lib/queries/bons-livraison";
import { signerBonLivraisonSchema } from "@/lib/validation/bon-livraison";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/bons-livraison/[id]/signer
 * Signe un bon de livraison (signature client + livreur).
 * Permission : VENTES_MODIFIER
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_MODIFIER);
    const { id } = await params;

    const body = await request.json();
    const parseResult = signerBonLivraisonSchema.safeParse(body);

    if (!parseResult.success) {
      return apiError(400, "Donnees invalides.", {
        errors: parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }

    const bonLivraison = await signerBonLivraison(
      auth.activeSiteId,
      auth.userId,
      id,
      parseResult.data
    );

    return NextResponse.json(bonLivraison);
  } catch (error) {
    return handleApiError(
      "POST /api/bons-livraison/[id]/signer",
      error,
      "Erreur serveur lors de la signature du bon de livraison.",
      { statusMap: [{ match: "introuvable", status: 404 }, { match: "deja signe", status: 409 }] }
    );
  }
}
