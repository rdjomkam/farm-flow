import { NextRequest, NextResponse } from "next/server";
import { replacePaliersRemise } from "@/lib/queries/previsions-scenarios";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { replacePaliersRemiseSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/**
 * PUT /api/previsions/scenarios/[id]/paliers-remise — remplace en bloc les
 * PalierRemise d'un scenario. PREVISIONS_PARAMETRER (ADR-053 section 6,
 * explicite : "paliers de remise").
 *
 * Validation bloquante §8(b) (seuils strictement croissants) : levee par
 * `replacePaliersRemise` (moteur, dans la meme transaction que l'ecriture,
 * R4) — mappee ici a 422 via PREVISIONS_STATUS_MAP, jamais un 500.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(replacePaliersRemiseSchema, body);
    if (parsed.error) return parsed.error;

    const paliers = await replacePaliersRemise(id, auth.activeSiteId, parsed.data.paliers);
    return NextResponse.json(paliers);
  } catch (error) {
    return handleApiError(
      "PUT /api/previsions/scenarios/[id]/paliers-remise",
      error,
      "Erreur serveur lors de la mise a jour des paliers de remise.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
