import { NextRequest, NextResponse } from "next/server";
import { supprimerPaiementDepense } from "@/lib/queries/depenses";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; paiementId: string }> };

/**
 * DELETE /api/depenses/[id]/paiements/[paiementId]
 * Supprime un paiement d'une depense.
 *
 * Regles metier :
 * - Verifie que le paiement appartient a la depense (meme site)
 * - Cree un audit trail AjustementDepense avant suppression
 * - FraisPaiementDepense cascades automatiquement
 * - Recalcule montantPaye, montantFraisSupp et statut
 *
 * Permission : DEPENSES_PAYER (symetrique avec POST)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_PAYER);
    const { id, paiementId } = await params;

    const result = await supprimerPaiementDepense(
      auth.activeSiteId,
      id,
      paiementId,
      auth.userId
    );

    return NextResponse.json(result, { status: 200 });
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
    if (message.includes("n'appartient pas")) {
      return apiError(422, message);
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la suppression du paiement.",
      },
      { status: 500 }
    );
  }
}
