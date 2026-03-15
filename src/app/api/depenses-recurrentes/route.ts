import { NextRequest, NextResponse } from "next/server";
import {
  getDepensesRecurrentes,
  createDepenseRecurrente,
} from "@/lib/queries/depenses-recurrentes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
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
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du chargement des templates." },
      { status: 500 }
    );
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
      return NextResponse.json(
        { status: 400, message: "description est requis." },
        { status: 400 }
      );
    }
    if (!body.categorieDepense || !VALID_CATEGORIES.includes(body.categorieDepense)) {
      return NextResponse.json(
        { status: 400, message: "categorieDepense invalide." },
        { status: 400 }
      );
    }
    if (typeof body.montantEstime !== "number" || body.montantEstime <= 0) {
      return NextResponse.json(
        { status: 400, message: "montantEstime doit etre un nombre positif." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { status: 400, message: "jourDuMois doit etre compris entre 1 et 28." },
        { status: 400 }
      );
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
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
