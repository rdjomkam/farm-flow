import { NextRequest, NextResponse } from "next/server";
import { replaceRepartitionsMoisAliment } from "@/lib/queries/previsions-aliments";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { replaceRepartitionsMoisAlimentSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/**
 * PUT /api/previsions/aliments/[id]/repartitions — remplace en bloc les
 * RepartitionMoisAliment d'un AlimentPrevision. PREVISIONS_PARAMETRER.
 *
 * Validation bloquante §8(a) (somme des pourcentages = 100%) : levee par
 * `replaceRepartitionsMoisAliment` (moteur, meme transaction que l'ecriture,
 * R4) — mappee ici a 422 via PREVISIONS_STATUS_MAP, jamais un 500.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(replaceRepartitionsMoisAlimentSchema, body);
    if (parsed.error) return parsed.error;

    const repartitions = await replaceRepartitionsMoisAliment(id, auth.activeSiteId, parsed.data.repartitions);
    return NextResponse.json(repartitions);
  } catch (error) {
    return handleApiError(
      "PUT /api/previsions/aliments/[id]/repartitions",
      error,
      "Erreur serveur lors de la mise a jour des repartitions mensuelles.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
