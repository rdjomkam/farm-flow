import { NextRequest, NextResponse } from "next/server";
import {
  getListeBesoinsById,
  updateListeBesoins,
  deleteListeBesoins,
} from "@/lib/queries/besoins";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, UniteBesoin } from "@/types";

const VALID_UNITES = Object.values(UniteBesoin);

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
        if (
          ligne.unite !== undefined &&
          ligne.unite !== null &&
          !VALID_UNITES.includes(ligne.unite as UniteBesoin)
        ) {
          return NextResponse.json(
            {
              status: 400,
              message: `Unite invalide : "${ligne.unite}". Valeurs autorisees : ${VALID_UNITES.join(", ")}.`,
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

    // Validation vagues si fournies
    if (body.vagues !== undefined && body.vagues !== null && Array.isArray(body.vagues) && body.vagues.length > 0) {
      const vaguesArr = body.vagues as Array<{ vagueId?: unknown; ratio?: unknown }>;
      for (let i = 0; i < vaguesArr.length; i++) {
        const v = vaguesArr[i];
        if (!v.vagueId || typeof v.vagueId !== "string") {
          return apiError(400, `vagueId requis pour l'entree vague ${i + 1}.`);
        }
        if (v.ratio === undefined || typeof v.ratio !== "number" || (v.ratio as number) <= 0 || (v.ratio as number) > 1) {
          return apiError(400, `Ratio invalide pour la vague ${i + 1} (doit etre > 0 et <= 1).`);
        }
      }
      const somme = vaguesArr.reduce((acc, v) => acc + (typeof v.ratio === "number" ? v.ratio : 0), 0);
      if (Math.abs(somme - 1.0) > 0.001) {
        return apiError(400, `La somme des ratios doit etre egale a 1.0 (somme actuelle : ${somme.toFixed(3)}).`);
      }
    }

    const listeBesoins = await updateListeBesoins(id, auth.activeSiteId, {
      titre: body.titre,
      vagues: body.vagues,
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
