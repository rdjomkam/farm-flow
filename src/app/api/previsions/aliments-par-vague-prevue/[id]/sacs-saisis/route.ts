import { NextRequest, NextResponse } from "next/server";
import { updateSacsSaisis } from "@/lib/queries/previsions-vagues";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { updateSacsSaisisSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * PATCH /api/previsions/aliments-par-vague-prevue/[id]/sacs-saisis — met a
 * jour la surcharge manuelle `sacsSaisis` d'une ligne AlimentParVaguePrevue
 * (ADR-053 section 3.6 : `null` = utiliser `sacsCalcules`, non-null =
 * l'exploitant a ajuste le besoin reel constate sur le terrain).
 * PREVISIONS_GERER (surcharge terrain, explicite ADR-053 section 6).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(updateSacsSaisisSchema, body);
    if (parsed.error) return parsed.error;

    const ligne = await updateSacsSaisis(id, auth.activeSiteId, parsed.data.sacsSaisis);
    return NextResponse.json(ligne);
  } catch (error) {
    return handleApiError(
      "PATCH /api/previsions/aliments-par-vague-prevue/[id]/sacs-saisis",
      error,
      "Erreur serveur lors de la mise a jour de la surcharge sacsSaisis."
    );
  }
}
