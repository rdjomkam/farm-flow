import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getConfigElevageById,
  updateConfigElevage,
  deleteConfigElevage } from "@/lib/queries/config-elevage";
import { apiError, handleApiError } from "@/lib/api-utils";
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
      return apiError(404, "Profil de configuration introuvable.");
    }

    return NextResponse.json({ config });
  } catch (error) {
    return handleApiError("GET /api/config-elevage/[id]", error, "Erreur serveur lors de la recuperation du profil.");
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
      return apiError(404, "Profil de configuration introuvable.");
    }

    return NextResponse.json({ config });
  } catch (error) {
    return handleApiError("PUT /api/config-elevage/[id]", error, "Erreur serveur lors de la mise a jour du profil.");
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
      return apiError(404, "Profil de configuration introuvable.");
    }

    if (result === "IS_DEFAULT") {
      return apiError(409, "Impossible de supprimer le profil par defaut. Definissez un autre profil par defaut d'abord.");
    }

    return NextResponse.json({ message: "Profil supprime avec succes.", id: result.id });
  } catch (error) {
    return handleApiError("DELETE /api/config-elevage/[id]", error, "Erreur serveur lors de la suppression du profil.");
  }
}
