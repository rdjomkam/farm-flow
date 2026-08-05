import { NextRequest, NextResponse } from "next/server";
import { getChargesMensuellesParScenario } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * GET /api/previsions/scenarios/[id]/charges — liste les ChargeMensuellePrevue
 * d'un scenario, filtre optionnel sur un mois (`?moisAbsolu=`).
 * PREVISIONS_VOIR.
 *
 * L'ecriture (creation/mise a jour) se fait via
 * `PUT /api/previsions/postes/[id]/charges` (upsert par poste x mois), pas
 * ici — cette route reste en lecture seule.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const moisAbsoluRaw = searchParams.get("moisAbsolu");
    let moisAbsolu: number | undefined;
    if (moisAbsoluRaw !== null) {
      const parsedValue = Number(moisAbsoluRaw);
      if (!Number.isInteger(parsedValue)) {
        return apiError(400, "Le parametre 'moisAbsolu' doit etre un entier.");
      }
      moisAbsolu = parsedValue;
    }

    const charges = await getChargesMensuellesParScenario(id, auth.activeSiteId, moisAbsolu);
    return NextResponse.json({ data: charges });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/charges",
      error,
      "Erreur serveur lors de la recuperation des charges mensuelles."
    );
  }
}
