import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getCustomPlaceholderById,
  updateCustomPlaceholder,
  deleteCustomPlaceholder } from "@/lib/queries/custom-placeholders";
import { apiError, handleApiError } from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/regles-activites/placeholders/[id]
 * Recupere un custom placeholder par ID.
 *
 * Permission : REGLES_ACTIVITES_VOIR
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(request, Permission.REGLES_ACTIVITES_VOIR);
    const { id } = await context.params;

    const placeholder = await getCustomPlaceholderById(id);
    if (!placeholder) {
      return apiError(404, "Placeholder introuvable.");
    }

    return NextResponse.json(placeholder);
  } catch (error) {
    return handleApiError("GET /api/regles-activites/placeholders/[id]", error, "Erreur serveur lors de la recuperation du placeholder.");
  }
}

/**
 * PUT /api/regles-activites/placeholders/[id]
 * Met a jour un custom placeholder existant.
 *
 * Permission : GERER_REGLES_GLOBALES
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(request, Permission.GERER_REGLES_GLOBALES);
    const { id } = await context.params;
    const body = await request.json();

    const updated = await updateCustomPlaceholder(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError("PUT /api/regles-activites/placeholders/[id]", error, "Erreur serveur.", {
      statusMap: [
        { match: "Unique constraint", status: 409 },
      ],
    });
  }
}

/**
 * DELETE /api/regles-activites/placeholders/[id]
 * Supprime un custom placeholder.
 *
 * Permission : GERER_REGLES_GLOBALES
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(request, Permission.GERER_REGLES_GLOBALES);
    const { id } = await context.params;

    await deleteCustomPlaceholder(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError("DELETE /api/regles-activites/placeholders/[id]", error, "Erreur serveur.");
  }
}
