import { NextRequest, NextResponse } from "next/server";
import { getVaguesPrevuesParScenario, createVaguePrevue } from "@/lib/queries/previsions-vagues";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutVaguePrevue } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { createVaguePrevueSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

const VALID_STATUTS = new Set(Object.values(StatutVaguePrevue));

/** GET /api/previsions/scenarios/[id]/vagues — liste les VaguePrevue d'un scenario (plan). PREVISIONS_VOIR. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const statutRaw = searchParams.get("statut");
    if (statutRaw && !VALID_STATUTS.has(statutRaw as StatutVaguePrevue)) {
      return apiError(
        400,
        `Le parametre 'statut' est invalide. Valeurs acceptees : ${Object.values(StatutVaguePrevue).join(", ")}.`
      );
    }
    const withAliments = searchParams.get("withAliments") === "true";

    const vagues = await getVaguesPrevuesParScenario(id, auth.activeSiteId, {
      statut: statutRaw ? (statutRaw as StatutVaguePrevue) : undefined,
      withAliments,
    });

    return NextResponse.json({ data: vagues });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/vagues",
      error,
      "Erreur serveur lors de la recuperation des vagues prevues.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}

/**
 * POST /api/previsions/scenarios/[id]/vagues — cree une VaguePrevue (plan
 * d'empoissonnement). PREVISIONS_GERER (ADR-053 section 6, explicite :
 * "vagues prevues").
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(createVaguePrevueSchema, body);
    if (parsed.error) return parsed.error;

    const vaguePrevue = await createVaguePrevue(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(vaguePrevue, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/vagues",
      error,
      "Erreur serveur lors de la creation de la vague prevue.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
