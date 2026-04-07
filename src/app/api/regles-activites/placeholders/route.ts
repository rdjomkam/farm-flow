import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getCustomPlaceholders,
  createCustomPlaceholder } from "@/lib/queries/custom-placeholders";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * GET /api/regles-activites/placeholders
 * Liste tous les custom placeholders (actifs et inactifs).
 *
 * Query params :
 *   - onlyActive : "true" — retourne uniquement les placeholders actifs
 *
 * Permission : REGLES_ACTIVITES_VOIR
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, Permission.REGLES_ACTIVITES_VOIR);
    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get("onlyActive") === "true";

    const placeholders = await getCustomPlaceholders(onlyActive);
    return NextResponse.json({ placeholders, total: placeholders.length });
  } catch (error) {
    return handleApiError("GET /api/regles-activites/placeholders", error, "Erreur serveur lors de la recuperation des placeholders.");
  }
}

/**
 * POST /api/regles-activites/placeholders
 * Cree un nouveau custom placeholder.
 *
 * Permission : GERER_REGLES_GLOBALES
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, Permission.GERER_REGLES_GLOBALES);
    const body = await request.json();

    // Required fields validation
    const missing: string[] = [];
    if (!body.key || typeof body.key !== "string") missing.push("key");
    if (!body.label || typeof body.label !== "string") missing.push("label");
    if (!body.example || typeof body.example !== "string") missing.push("example");
    if (!body.mode || typeof body.mode !== "string") missing.push("mode");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Champs requis manquants: ${missing.join(", ")}.` },
        { status: 400 }
      );
    }

    const placeholder = await createCustomPlaceholder(body);
    return NextResponse.json({ placeholder }, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/regles-activites/placeholders", error, "Erreur serveur.");
  }
}
