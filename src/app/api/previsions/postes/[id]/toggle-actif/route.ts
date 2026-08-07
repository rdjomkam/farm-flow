import { NextRequest, NextResponse } from "next/server";
import { togglePostePrevisionActif } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";

/**
 * POST /api/previsions/postes/[id]/toggle-actif — active/desactive un
 * PostePrevision (desactivation logique, R4) : un poste inactif est exclu du
 * calcul de projection sans etre supprime. PREVISIONS_GERER, meme niveau que
 * la saisie des charges mensuelles.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();
    const actif = typeof body.actif === "boolean" ? body.actif : true;

    const poste = await togglePostePrevisionActif(id, auth.activeSiteId, actif);
    return NextResponse.json(poste);
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/postes/[id]/toggle-actif",
      error,
      "Erreur serveur lors du changement de statut du poste."
    );
  }
}
