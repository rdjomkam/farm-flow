import { NextRequest, NextResponse } from "next/server";
import { updateParametresPrevision } from "@/lib/queries/previsions-scenarios";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { updateParametresPrevisionSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * PUT /api/previsions/scenarios/[id]/parametres — met a jour les
 * ParametresPrevision d'un scenario (1-1). PREVISIONS_PARAMETRER (ADR-053
 * section 6, explicite : "editer ParametresPrevision").
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(updateParametresPrevisionSchema, body);
    if (parsed.error) return parsed.error;

    const parametres = await updateParametresPrevision(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(parametres);
  } catch (error) {
    return handleApiError(
      "PUT /api/previsions/scenarios/[id]/parametres",
      error,
      "Erreur serveur lors de la mise a jour des parametres."
    );
  }
}
