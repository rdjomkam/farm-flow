import { NextRequest, NextResponse } from "next/server";
import { scinderVaguePrevue } from "@/lib/queries/previsions-vagues";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { scinderVaguePrevueSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * POST /api/previsions/vagues-prevues/[id]/scinder — scinde une VaguePrevue
 * en N vagues filles (ex. V7 -> V7a + V7b, `vaguePrevueParentId`), passe le
 * parent en ANNULEE (jamais une suppression physique, ADR-053 decision 2).
 * PREVISIONS_GERER.
 *
 * Cette route reste utilisable INDEPENDAMMENT de `POST
 * /vagues-prevues/[id]/rattacher` (l'utilisateur peut scinder
 * preventivement, pas seulement en reaction a un rejet 409
 * VAGUE_PREVUE_DEJA_RATTACHEE) — aucune dependance forcee entre les deux
 * routes, conformement a la pre-analyse PR2.2 section 4, point 4.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(scinderVaguePrevueSchema, body);
    if (parsed.error) return parsed.error;

    const enfants = await scinderVaguePrevue(id, auth.activeSiteId, parsed.data.scissions);
    return NextResponse.json({ data: enfants }, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/vagues-prevues/[id]/scinder",
      error,
      "Erreur serveur lors de la scission de la vague prevue."
    );
  }
}
