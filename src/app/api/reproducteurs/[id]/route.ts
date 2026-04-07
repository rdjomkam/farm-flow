import { NextRequest, NextResponse } from "next/server";
import { getReproducteurById,
  updateReproducteur,
  deleteReproducteur } from "@/lib/queries/reproducteurs";
import { apiError, handleApiError } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { Permission, SexeReproducteur, StatutReproducteur } from "@/types";
import type { UpdateReproducteurDTO } from "@/lib/queries/reproducteurs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { id } = await params;

    const reproducteur = await getReproducteurById(id, auth.activeSiteId);
    if (!reproducteur) {
      return apiError(404, "Reproducteur introuvable.");
    }

    return NextResponse.json(reproducteur);
  } catch (error) {
    return handleApiError("GET /api/reproducteurs/[id]", error, "Erreur serveur.");
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation : code optionnel
    if (body.code !== undefined) {
      if (typeof body.code !== "string" || body.code.trim() === "") {
        errors.push({ field: "code", message: "Le code ne peut pas etre vide." });
      }
    }

    // Validation : sexe optionnel
    if (
      body.sexe !== undefined &&
      !Object.values(SexeReproducteur).includes(body.sexe as SexeReproducteur)
    ) {
      errors.push({
        field: "sexe",
        message: `Sexe invalide. Valeurs acceptees : ${Object.values(SexeReproducteur).join(", ")}.`,
      });
    }

    // Validation : poids optionnel > 0
    if (body.poids !== undefined) {
      if (typeof body.poids !== "number" || body.poids <= 0) {
        errors.push({ field: "poids", message: "Le poids doit etre un nombre superieur a 0." });
      }
    }

    // Validation : age optionnel >= 0
    if (body.age !== undefined && body.age !== null) {
      if (!Number.isInteger(body.age) || body.age < 0) {
        errors.push({ field: "age", message: "L'age doit etre un entier positif ou nul." });
      }
    }

    // Validation : statut optionnel
    if (
      body.statut !== undefined &&
      !Object.values(StatutReproducteur).includes(body.statut as StatutReproducteur)
    ) {
      errors.push({
        field: "statut",
        message: `Statut invalide. Valeurs acceptees : ${Object.values(StatutReproducteur).join(", ")}.`,
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: UpdateReproducteurDTO = {};
    if (body.code !== undefined) data.code = body.code.trim();
    if (body.poids !== undefined) data.poids = body.poids;
    if (body.age !== undefined) data.age = body.age;
    if (body.origine !== undefined) data.origine = body.origine?.trim() || undefined;
    if (body.statut !== undefined) data.statut = body.statut as StatutReproducteur;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || undefined;

    const reproducteur = await updateReproducteur(id, auth.activeSiteId, data);
    return NextResponse.json(reproducteur);
  } catch (error) {
    return handleApiError("PUT /api/reproducteurs/[id]", error, "Erreur serveur.", {
      statusMap: [
        { match: ["n'est pas ACTIF", "statut doit etre"], status: 409 },
      ],
    });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_SUPPRIMER);
    const { id } = await params;

    await deleteReproducteur(id, auth.activeSiteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError("DELETE /api/reproducteurs/[id]", error, "Erreur serveur.", {
      statusMap: [
        { match: "ponte", status: 409 },
      ],
    });
  }
}
