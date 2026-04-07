import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { dupliquerConfigElevage } from "@/lib/queries/config-elevage";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * POST /api/config-elevage/[id]/dupliquer
 * Duplique un profil ConfigElevage avec un nouveau nom.
 * Le duplicat n'est jamais isDefault=true.
 * Permission : SITE_GERER (ADMIN ou GERANT — EC-12.2)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER);
    const { id } = await params;

    const body = await request.json();
    const nouveauNom = body?.nom;

    if (!nouveauNom || typeof nouveauNom !== "string" || nouveauNom.trim().length === 0) {
      return apiError(400, "Le champ 'nom' est obligatoire pour la duplication.");
    }

    const config = await dupliquerConfigElevage(id, auth.activeSiteId, nouveauNom.trim());
    if (!config) {
      return apiError(404, "Profil de configuration source introuvable.");
    }

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/config-elevage/[id]/dupliquer", error, "Erreur serveur lors de la duplication du profil.");
  }
}
