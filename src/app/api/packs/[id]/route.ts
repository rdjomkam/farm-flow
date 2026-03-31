import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getPackById, updatePack, deletePack } from "@/lib/queries/packs";
import { apiError } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/packs/[id]
 * Recupere les details d'un pack.
 * Permission : DASHBOARD_VOIR
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);

    const pack = await getPackById(id, auth.activeSiteId);
    if (!pack) {
      return apiError(404, "Pack introuvable.");
    }

    return NextResponse.json(pack);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation du pack.");
  }
}

/**
 * PUT /api/packs/[id]
 * Met a jour un Pack.
 * Permission : GERER_PACKS
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.GERER_PACKS);

    const body = await request.json();

    // Validation
    if (body.nombreAlevins !== undefined && (typeof body.nombreAlevins !== "number" || body.nombreAlevins <= 0)) {
      return apiError(400, "Le nombre d'alevins doit etre superieur a 0.");
    }
    if (body.prixTotal !== undefined && (typeof body.prixTotal !== "number" || body.prixTotal < 0)) {
      return apiError(400, "Le prix total ne peut pas etre negatif.");
    }

    const updated = await updatePack(id, auth.activeSiteId, body);
    if (!updated) {
      return apiError(404, "Pack introuvable.");
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    if (error instanceof Error && (
      error.message.includes("desactiver") ||
      error.message.includes("alevins") ||
      error.message.includes("negatif")
    )) {
      return apiError(409, error.message);
    }
    return apiError(500, "Erreur serveur lors de la mise a jour du pack.");
  }
}

/**
 * DELETE /api/packs/[id]
 * Supprime un Pack.
 * Permission : GERER_PACKS
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.GERER_PACKS);

    const deleted = await deletePack(id, auth.activeSiteId);
    if (!deleted) {
      return apiError(404, "Pack introuvable.");
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    if (error instanceof Error && error.message.includes("supprimer")) {
      return apiError(409, error.message);
    }
    return apiError(500, "Erreur serveur lors de la suppression du pack.");
  }
}
