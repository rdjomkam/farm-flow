import { NextRequest, NextResponse } from "next/server";
import {
  getAlimentsPrevisionParScenario,
  createAlimentPrevisionAvecArticle,
} from "@/lib/queries/previsions-aliments";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { createAlimentPrevisionSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/** GET /api/previsions/scenarios/[id]/aliments — liste les AlimentPrevision d'un scenario. PREVISIONS_VOIR. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;

    const aliments = await getAlimentsPrevisionParScenario(id, auth.activeSiteId);
    return NextResponse.json({ data: aliments });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/aliments",
      error,
      "Erreur serveur lors de la recuperation des aliments previsionnels."
    );
  }
}

/**
 * POST /api/previsions/scenarios/[id]/aliments — cree un AlimentPrevision
 * (le CALIBRE) ET son unique AlimentArticlePrevision (l'ARTICLE), dans le
 * MEME appel, meme transaction Prisma (ADR-053 §12.6 : "creer un calibre
 * cree son article dans le meme geste", jamais deux appels distincts cote
 * client). PREVISIONS_PARAMETRER (ADR-053 section 6, explicite : referentiel
 * aliments/granulometries).
 *
 * Validation bloquante §8(a) (somme des repartitions mensuelles = 100%) si
 * des `repartitions` sont fournies a la creation : levee par
 * `createAlimentPrevisionAvecArticle` (meme transaction que l'ecriture, R4) —
 * levee en `BusinessRuleError(msg, 422)` (ERR-165).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(createAlimentPrevisionSchema, body);
    if (parsed.error) return parsed.error;

    const aliment = await createAlimentPrevisionAvecArticle(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(aliment, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/aliments",
      error,
      "Erreur serveur lors de la creation de l'aliment previsionnel."
    );
  }
}
