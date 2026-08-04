import { NextRequest, NextResponse } from "next/server";
import { addAlimentArticlePrevision } from "@/lib/queries/previsions-aliments";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { addAlimentArticlePrevisionSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/**
 * POST /api/previsions/aliments/[id]/articles — ajoute un second (ou
 * N-ieme) article a un calibre existant. Action SECONDAIRE explicite
 * (ADR-053 §12.6) : c'est le SEUL moment ou la part d'approvisionnement
 * devient saisissable — le corps porte la repartition COMPLETE de tous les
 * articles du calibre apres ajout (celui deja existant, dont la part passe
 * de 100% implicite a une valeur explicite, inclus).
 *
 * Validation bloquante (ADR-053 §12.2 arbitrage 3, somme des parts = 100%) :
 * levee par `addAlimentArticlePrevision` (meme transaction que l'ecriture,
 * R4) — mappee ici a 422 via PREVISIONS_STATUS_MAP.
 *
 * PREVISIONS_PARAMETRER (meme permission que la creation d'un calibre —
 * ADR-053 section 6, referentiel aliments/granulometries).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_PARAMETRER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(addAlimentArticlePrevisionSchema, body);
    if (parsed.error) return parsed.error;

    const aliment = await addAlimentArticlePrevision(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(aliment, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/aliments/[id]/articles",
      error,
      "Erreur serveur lors de l'ajout de l'article previsionnel.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
