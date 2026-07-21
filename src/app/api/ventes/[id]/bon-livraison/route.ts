import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import {
  createBonLivraison,
  getBonLivraisonByVente,
} from "@/lib/queries/bons-livraison";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/ventes/[id]/bon-livraison
 * Recupere le bon de livraison d'une vente (detail + bloc paiement).
 * Permission : VENTES_VOIR
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_VOIR);
    const { id } = await params;

    const result = await getBonLivraisonByVente(auth.activeSiteId, id);
    if (!result) {
      return apiError(404, "Aucun bon de livraison pour cette vente.");
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(
      "GET /api/ventes/[id]/bon-livraison",
      error,
      "Erreur serveur lors de la recuperation du bon de livraison.",
      { statusMap: [{ match: "introuvable", status: 404 }] }
    );
  }
}

/**
 * POST /api/ventes/[id]/bon-livraison
 * Cree le bon de livraison d'une vente (idempotent).
 * Permission : VENTES_MODIFIER
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.VENTES_MODIFIER);
    const { id } = await params;

    const bonLivraison = await createBonLivraison(
      auth.activeSiteId,
      auth.userId,
      id
    );

    return NextResponse.json(bonLivraison, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/ventes/[id]/bon-livraison",
      error,
      "Erreur serveur lors de la creation du bon de livraison.",
      {
        statusMap: [
          { match: "introuvable", status: 404 },
          { match: "en preparation", status: 409 },
        ],
      }
    );
  }
}
