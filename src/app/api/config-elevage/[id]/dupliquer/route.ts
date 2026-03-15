import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { dupliquerConfigElevage } from "@/lib/queries/config-elevage";

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
      return NextResponse.json(
        { status: 400, message: "Le champ 'nom' est obligatoire pour la duplication." },
        { status: 400 }
      );
    }

    const config = await dupliquerConfigElevage(id, auth.activeSiteId, nouveauNom.trim());
    if (!config) {
      return NextResponse.json(
        { status: 404, message: "Profil de configuration source introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la duplication du profil." },
      { status: 500 }
    );
  }
}
