import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getScenarios, createScenario } from "@/lib/queries/previsions-scenarios";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutScenarioPrevision, parsePaginationQuery } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { createScenarioSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

const VALID_STATUTS = new Set(Object.values(StatutScenarioPrevision));

/**
 * GET /api/previsions/scenarios — liste les scenarios du site actif.
 * PREVISIONS_VOIR (lecture).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { searchParams } = new URL(request.url);

    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const statutRaw = searchParams.get("statut");
    if (statutRaw && !VALID_STATUTS.has(statutRaw as StatutScenarioPrevision)) {
      return apiError(
        400,
        `Le parametre 'statut' est invalide. Valeurs acceptees : ${Object.values(StatutScenarioPrevision).join(", ")}.`
      );
    }
    const statut = statutRaw ? (statutRaw as StatutScenarioPrevision) : undefined;

    const { data, total } = await getScenarios(
      auth.activeSiteId,
      statut ? { statut } : undefined,
      { limit, offset }
    );

    return cachedJson({ data, total, limit, offset }, "medium");
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios",
      error,
      "Erreur serveur lors de la recuperation des scenarios."
    );
  }
}

/**
 * POST /api/previsions/scenarios — cree un scenario complet (ScenarioPrevision
 * + ParametresPrevision 1-1 obligatoire, ADR-053 section 3.3).
 *
 * Permission : PREVISIONS_GERER (decision explicite du sprint — creer/editer
 * un scenario est un acte de gestion, ADR-053 section 6 tableau des roles ;
 * les valeurs de ParametresPrevision fournies ICI a la creation restent
 * ensuite modifiables uniquement via PREVISIONS_PARAMETRER,
 * `PUT /api/previsions/scenarios/[id]/parametres` — un Gestionnaire peut donc
 * demarrer un scenario avec des parametres par defaut, seul un Administrateur
 * peut les ajuster ensuite).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const body = await request.json();

    const parsed = parseBody(createScenarioSchema, body);
    if (parsed.error) return parsed.error;

    const scenario = await createScenario(auth.activeSiteId, {
      ...parsed.data,
      userId: auth.userId,
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios",
      error,
      "Erreur serveur lors de la creation du scenario."
    );
  }
}
