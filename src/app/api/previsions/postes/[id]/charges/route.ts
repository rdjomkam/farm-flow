import { NextRequest, NextResponse } from "next/server";
import { upsertChargeMensuelle } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { upsertChargeMensuelleSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/**
 * PUT /api/previsions/postes/[id]/charges — cree ou met a jour le montant
 * d'un PostePrevision pour un mois absolu donne (upsert natif,
 * `@@unique([posteId, moisAbsolu])`, R4). PREVISIONS_GERER (saisie des
 * charges mensuelles — decision explicite du sprint : la saisie du montant
 * est un acte de gestion, distinct de la creation du referentiel de postes
 * lui-meme, qui reste PREVISIONS_PARAMETRER).
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(upsertChargeMensuelleSchema, body);
    if (parsed.error) return parsed.error;

    const charge = await upsertChargeMensuelle(id, auth.activeSiteId, parsed.data.moisAbsolu, parsed.data.montantFCFA);
    return NextResponse.json(charge);
  } catch (error) {
    return handleApiError(
      "PUT /api/previsions/postes/[id]/charges",
      error,
      "Erreur serveur lors de la mise a jour de la charge mensuelle.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
