import { NextRequest, NextResponse } from "next/server";
import { utiliserMale } from "@/lib/queries/geniteurs";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/reproduction/geniteurs/[id]/utiliser-male
 * Décrémente atomiquement le stock de mâles disponibles d'un lot de géniteurs.
 *
 * Body JSON :
 *   - nombreUtilises (number, obligatoire) — nombre de mâles à utiliser (entier > 0)
 *
 * Réponse :
 *   - { nombreMalesDisponibles: number } — nouveau stock après décrémentation
 *
 * Codes d'erreur :
 *   - 400 — nombreUtilises invalide ou lot n'est pas de sexe MALE
 *   - 404 — lot introuvable
 *   - 409 — stock insuffisant
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.GENITEURS_GERER);
    const { id } = await params;

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Le corps de la requête doit être un JSON valide.");
    }

    // Validate nombreUtilises
    const { nombreUtilises } = body as Record<string, unknown>;

    if (nombreUtilises === undefined || nombreUtilises === null) {
      return apiError(400, "Le champ 'nombreUtilises' est obligatoire.");
    }

    if (
      typeof nombreUtilises !== "number" ||
      !Number.isInteger(nombreUtilises) ||
      nombreUtilises <= 0
    ) {
      return apiError(
        400,
        "Le champ 'nombreUtilises' doit être un entier positif (> 0)."
      );
    }

    const nombreMalesDisponibles = await utiliserMale(
      id,
      auth.activeSiteId,
      nombreUtilises
    );

    return NextResponse.json({ nombreMalesDisponibles }, { status: 200 });
  } catch (error) {
    return handleApiError(
      "POST /api/reproduction/geniteurs/[id]/utiliser-male",
      error,
      "Erreur serveur lors de l'utilisation des mâles.",
      {
        statusMap: [
          {
            match: ["n'est pas un lot de mâles", "n'est pas initialisé"],
            status: 400,
          },
          {
            match: "Stock insuffisant",
            status: 409,
          },
        ],
      }
    );
  }
}
