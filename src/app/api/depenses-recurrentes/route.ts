import { NextRequest, NextResponse } from "next/server";
import { getDepensesRecurrentes,
  createDepenseRecurrente } from "@/lib/queries/depenses-recurrentes";
import { apiError, handleApiError } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { CategorieDepense, FrequenceRecurrence, Permission } from "@/types";
import type { CreateDepenseRecurrenteDTO } from "@/types";

const VALID_CATEGORIES = Object.values(CategorieDepense);
const VALID_FREQUENCES = Object.values(FrequenceRecurrence);

/**
 * GET /api/depenses-recurrentes
 * Liste les templates de dépenses récurrentes du site actif.
 * Permission : DEPENSES_VOIR
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_VOIR);
    const { searchParams } = new URL(request.url);

    const onlyActiveStr = searchParams.get("onlyActive");
    const onlyActive =
      onlyActiveStr === "true" ? true : onlyActiveStr === "false" ? false : undefined;

    const templates = await getDepensesRecurrentes(auth.activeSiteId, onlyActive);

    return NextResponse.json({ templates, total: templates.length });
  } catch (error) {
    return handleApiError("GET /api/depenses-recurrentes", error, "Erreur serveur lors du chargement des templates.");
  }
}

/**
 * POST /api/depenses-recurrentes
 * Crée un template de dépense récurrente.
 * Permission : DEPENSES_CREER
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);
    const body = await request.json();

    // Validation
    if (!body.description || typeof body.description !== "string") {
      return apiError(400, "description est requis.");
    }
    if (!body.categorieDepense || !VALID_CATEGORIES.includes(body.categorieDepense)) {
      return apiError(400, "categorieDepense invalide.");
    }
    if (typeof body.montantEstime !== "number" || body.montantEstime <= 0) {
      return apiError(400, "montantEstime doit etre un nombre positif.");
    }
    if (!body.frequence || !VALID_FREQUENCES.includes(body.frequence)) {
      return NextResponse.json(
        { status: 400, message: "frequence invalide (MENSUEL, TRIMESTRIEL, ANNUEL)." },
        { status: 400 }
      );
    }
    if (
      body.jourDuMois !== undefined &&
      (typeof body.jourDuMois !== "number" || body.jourDuMois < 1 || body.jourDuMois > 28)
    ) {
      return apiError(400, "jourDuMois doit etre compris entre 1 et 28.");
    }

    const dto: CreateDepenseRecurrenteDTO = {
      description: body.description.trim(),
      categorieDepense: body.categorieDepense as CategorieDepense,
      montantEstime: body.montantEstime,
      frequence: body.frequence as FrequenceRecurrence,
      jourDuMois: body.jourDuMois,
      isActive: body.isActive,
    };

    const template = await createDepenseRecurrente(auth.activeSiteId, auth.userId, dto);

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/depenses-recurrentes", error, "Erreur serveur.");
  }
}
