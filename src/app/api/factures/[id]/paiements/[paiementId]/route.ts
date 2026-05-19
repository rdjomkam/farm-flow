import { NextRequest, NextResponse } from "next/server";
import { supprimerPaiement } from "@/lib/queries/factures";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; paiementId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PAIEMENTS_SUPPRIMER);
    const { id: factureId, paiementId } = await params;

    const result = await supprimerPaiement(
      auth.activeSiteId,
      factureId,
      paiementId,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError("DELETE /api/factures/[id]/paiements/[paiementId]", error, "Erreur serveur lors de la suppression du paiement.", {
      statusMap: [
        { match: ["introuvable"], status: 404 },
        { match: ["cloturee", "annulee"], status: 409 },
      ],
    });
  }
}
