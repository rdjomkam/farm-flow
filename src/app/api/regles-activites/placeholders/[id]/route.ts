import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import {
  getCustomPlaceholderById,
  updateCustomPlaceholder,
  deleteCustomPlaceholder,
} from "@/lib/queries/custom-placeholders";

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
      return NextResponse.json({ error: "Placeholder introuvable." }, { status: 404 });
    }

    return NextResponse.json(placeholder);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[GET /api/regles-activites/placeholders/[id]]", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la recuperation du placeholder." },
      { status: 500 }
    );
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
      return NextResponse.json({ error: (error as Error).message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    // Prisma unique constraint violation
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Cette cle existe deja." },
        { status: 409 }
      );
    }
    if (message === "Placeholder introuvable.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("[PUT /api/regles-activites/placeholders/[id]]", error);
    return NextResponse.json({ error: message }, { status: 400 });
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
      return NextResponse.json({ error: (error as Error).message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message === "Placeholder introuvable.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("[DELETE /api/regles-activites/placeholders/[id]]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
