import { NextRequest, NextResponse } from "next/server";
import { getApportsCapitalParScenario, createApportCapital } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { createApportCapitalSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/** GET /api/previsions/scenarios/[id]/apports — liste les ApportCapital d'un scenario. PREVISIONS_VOIR. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const apports = await getApportsCapitalParScenario(id, auth.activeSiteId);
    return NextResponse.json({ data: apports });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/apports",
      error,
      "Erreur serveur lors de la recuperation des apports en capital.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}

/**
 * POST /api/previsions/scenarios/[id]/apports — cree un ApportCapital
 * (CAPITAL ou CREDIT — un credit encaisse est un apport de tresorerie,
 * jamais un investissement, ADR-053 section 3.1/7). PREVISIONS_GERER
 * (ADR-053 section 6, explicite : "apports en capital").
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(createApportCapitalSchema, body);
    if (parsed.error) return parsed.error;

    const apport = await createApportCapital(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(apport, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/apports",
      error,
      "Erreur serveur lors de la creation de l'apport en capital.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
