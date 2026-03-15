import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import {
  getConfigElevageById,
  updateConfigElevage,
  deleteConfigElevage,
} from "@/lib/queries/config-elevage";
import { updateConfigElevageSchema } from "@/lib/validation/config-elevage";

/**
 * GET /api/config-elevage/[id]
 * Retourne le detail d'un profil ConfigElevage.
 * Permission : DASHBOARD_VOIR
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);
    const { id } = await params;

    const config = await getConfigElevageById(id, auth.activeSiteId);
    if (!config) {
      return NextResponse.json(
        { status: 404, message: "Profil de configuration introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation du profil." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/config-elevage/[id]
 * Met a jour partiellement un profil ConfigElevage.
 * Permission : SITE_GERER (ADMIN ou GERANT — EC-12.2)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER);
    const { id } = await params;

    const body = await request.json();
    const parseResult = updateConfigElevageSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          status: 400,
          message: "Donnees invalides.",
          errors: parseResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const config = await updateConfigElevage(id, auth.activeSiteId, parseResult.data);
    if (!config) {
      return NextResponse.json(
        { status: 404, message: "Profil de configuration introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la mise a jour du profil." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/config-elevage/[id]
 * Supprime un profil ConfigElevage.
 * Interdit si isDefault=true.
 * Permission : SITE_GERER (ADMIN ou GERANT)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER);
    const { id } = await params;

    const result = await deleteConfigElevage(id, auth.activeSiteId);

    if (result === "NOT_FOUND") {
      return NextResponse.json(
        { status: 404, message: "Profil de configuration introuvable." },
        { status: 404 }
      );
    }

    if (result === "IS_DEFAULT") {
      return NextResponse.json(
        { status: 409, message: "Impossible de supprimer le profil par defaut. Definissez un autre profil par defaut d'abord." },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Profil supprime avec succes.", id: result.id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la suppression du profil." },
      { status: 500 }
    );
  }
}
