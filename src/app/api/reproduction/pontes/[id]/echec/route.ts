import { NextRequest, NextResponse } from "next/server";
import { markEchec } from "@/lib/queries/pontes";
import { apiError, handleApiError } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { Permission, CauseEchecPonte } from "@/types";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/reproduction/pontes/[id]/echec
 * Marque une ponte comme echouee et enregistre la cause d'echec.
 *
 * Body : { causeEchec: CauseEchecPonte, notes?: string }
 * Permission : PONTES_GERER
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_GERER);
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Corps de la requete invalide.");
    }

    // Validation : causeEchec est obligatoire
    if (!body.causeEchec) {
      return apiError(400, "Erreurs de validation.", {
        errors: [
          {
            field: "causeEchec",
            message: "La cause d'echec est obligatoire.",
          },
        ],
      });
    }

    // Validation : causeEchec doit etre une valeur valide de CauseEchecPonte
    const validCauses = Object.values(CauseEchecPonte);
    if (!validCauses.includes(body.causeEchec as CauseEchecPonte)) {
      return apiError(400, "Erreurs de validation.", {
        errors: [
          {
            field: "causeEchec",
            message: `Cause d'echec invalide. Valeurs acceptees : ${validCauses.join(", ")}.`,
          },
        ],
      });
    }

    const data: { causeEchec: CauseEchecPonte; notes?: string } = {
      causeEchec: body.causeEchec as CauseEchecPonte,
      ...(body.notes !== undefined && { notes: body.notes as string }),
    };

    const ponte = await markEchec(id, auth.activeSiteId, data);

    return NextResponse.json(ponte);
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/pontes/[id]/echec",
      error,
      "Erreur serveur lors du marquage de l'echec de la ponte."
    );
  }
}
