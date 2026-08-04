import { NextRequest, NextResponse } from "next/server";
import { getJournalDepensesParScenario, createJournalDepensePrevue } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission, CategorieJournalPrevu } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";
import { createJournalDepensePrevueSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

const VALID_CATEGORIES = new Set(Object.values(CategorieJournalPrevu));

/**
 * GET /api/previsions/scenarios/[id]/journal — liste le journal de depenses
 * prevues d'un scenario, filtres optionnels `vaguePrevueId` (y compris
 * `"null"` explicite pour les lignes GENERALES) et `categorie`.
 * PREVISIONS_VOIR.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_VOIR);
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const categorieRaw = searchParams.get("categorie");
    if (categorieRaw && !VALID_CATEGORIES.has(categorieRaw as CategorieJournalPrevu)) {
      return apiError(
        400,
        `Le parametre 'categorie' est invalide. Valeurs acceptees : ${Object.values(CategorieJournalPrevu).join(", ")}.`
      );
    }

    const vaguePrevueIdRaw = searchParams.get("vaguePrevueId");
    const vaguePrevueId = vaguePrevueIdRaw === "null" ? null : vaguePrevueIdRaw ?? undefined;

    const journal = await getJournalDepensesParScenario(id, auth.activeSiteId, {
      vaguePrevueId,
      categorie: categorieRaw ? (categorieRaw as CategorieJournalPrevu) : undefined,
    });
    return NextResponse.json({ data: journal });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/journal",
      error,
      "Erreur serveur lors de la recuperation du journal de depenses.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}

/**
 * POST /api/previsions/scenarios/[id]/journal — cree une ligne de journal de
 * depenses prevues. PREVISIONS_GERER (ADR-053 section 6, explicite :
 * "saisir le journal").
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(createJournalDepensePrevueSchema, body);
    if (parsed.error) return parsed.error;

    const ligne = await createJournalDepensePrevue(id, auth.activeSiteId, parsed.data);
    return NextResponse.json(ligne, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/scenarios/[id]/journal",
      error,
      "Erreur serveur lors de la creation de la ligne de journal.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
