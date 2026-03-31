import { NextRequest, NextResponse } from "next/server";
import {
  getListeBesoinsById,
  updateListeBesoins,
  deleteListeBesoins,
} from "@/lib/queries/besoins";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

/**
 * GET /api/besoins/[id]
 * Recupere une liste de besoins avec toutes ses relations.
 *
 * Permission : BESOINS_SOUMETTRE
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_SOUMETTRE
    );
    const { id } = await params;
    const listeBesoins = await getListeBesoinsById(id, auth.activeSiteId);
    if (!listeBesoins) {
      return apiError(404, "Liste de besoins introuvable.");
    }
    return NextResponse.json(listeBesoins);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur.");
  }
}

/**
 * PUT /api/besoins/[id]
 * Modifie une liste de besoins (seulement si statut SOUMISE).
 *
 * Permission : BESOINS_SOUMETTRE
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_SOUMETTRE
    );
    const { id } = await params;
    const body = await request.json();

    // Validation des lignes si fournies
    if (Array.isArray(body.lignes)) {
      for (const ligne of body.lignes) {
        const designationValide =
          typeof ligne.designation === "string" && ligne.designation.trim().length > 0;
        const quantiteValide =
          typeof ligne.quantite === "number" && ligne.quantite > 0;
        const prixEstimeValide =
          typeof ligne.prixEstime === "number" && ligne.prixEstime >= 0;

        if (!designationValide || !quantiteValide || !prixEstimeValide) {
          return NextResponse.json(
            {
              status: 400,
              message:
                "Ligne invalide : designation requise, quantite > 0, prixEstime >= 0.",
            },
            { status: 400 }
          );
        }
      }
    }

    // Validation dateLimite optionnelle
    let dateLimite: string | null | undefined;
    if (body.dateLimite === null) {
      dateLimite = null; // suppression explicite
    } else if (body.dateLimite != null) {
      const parsed = new Date(body.dateLimite);
      if (isNaN(parsed.getTime())) {
        return apiError(400, "Date limite invalide (format ISO 8601 attendu).");
      }
      dateLimite = parsed.toISOString();
    }

    const listeBesoins = await updateListeBesoins(id, auth.activeSiteId, {
      titre: body.titre,
      vagueId: body.vagueId,
      notes: body.notes,
      lignes: body.lignes,
      ...(dateLimite !== undefined && { dateLimite }),
    });

    return NextResponse.json(listeBesoins);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (
      message.includes("invalide") ||
      message.includes("Impossible") ||
      message.includes("SOUMISE")
    ) {
      return apiError(400, message);
    }
    return apiError(500, "Erreur serveur.");
  }
}

/**
 * DELETE /api/besoins/[id]
 * Supprime une liste de besoins (seulement si statut SOUMISE).
 *
 * Permission : BESOINS_SOUMETTRE
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_SOUMETTRE
    );
    const { id } = await params;
    await deleteListeBesoins(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("Impossible") || message.includes("SOUMISE")) {
      return apiError(400, message);
    }
    return apiError(500, "Erreur serveur.");
  }
}
