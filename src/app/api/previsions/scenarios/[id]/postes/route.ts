import { NextRequest, NextResponse } from "next/server";
import { getPostesPrevisionParScenario, createPostePrevision } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { createPostePrevisionSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/** GET /api/previsions/scenarios/[id]/postes — liste les PostePrevision d'un scenario. PREVISIONS_VOIR. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const postes = await getPostesPrevisionParScenario(id, auth.activeSiteId);
    return NextResponse.json({ data: postes });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/postes",
      error,
      "Erreur serveur lors de la recuperation des postes previsionnels.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}

/**
 * POST /api/previsions/scenarios/[id]/postes — cree un PostePrevision
 * (referentiel de charges, parametrable — pas un enum code en dur, ADR-053
 * section 3.8). PREVISIONS_PARAMETRER (ADR-053 section 6, explicite :
 * "PostePrevision").
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(createPostePrevisionSchema, body);
    if (parsed.error) return parsed.error;

    const poste = await createPostePrevision(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(poste, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/postes",
      error,
      "Erreur serveur lors de la creation du poste previsionnel.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
