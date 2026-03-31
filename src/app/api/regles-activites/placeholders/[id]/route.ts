import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import {
  getCustomPlaceholderById,
  updateCustomPlaceholder,
  deleteCustomPlaceholder,
} from "@/lib/queries/custom-placeholders";
import { apiError } from "@/lib/api-utils";

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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/regles-activites/placeholders/[id]]", error);
    return apiError(500, "Erreur serveur lors de la recuperation du placeholder.");
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
    if (error instanceof AuthError) {
      return apiError(401, (error as Error).message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, (error as Error).message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    // Prisma unique constraint violation
    if (message.includes("Unique constraint")) {
      return apiError(409, "Cette cle existe deja.");
    }
    if (message === "Placeholder introuvable.") {
      return apiError(404, message);
    }
    console.error("[PUT /api/regles-activites/placeholders/[id]]", error);
    return apiError(400, message);
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
    if (error instanceof AuthError) {
      return apiError(401, (error as Error).message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, (error as Error).message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message === "Placeholder introuvable.") {
      return apiError(404, message);
    }
    console.error("[DELETE /api/regles-activites/placeholders/[id]]", error);
    return apiError(400, message);
  }
}
