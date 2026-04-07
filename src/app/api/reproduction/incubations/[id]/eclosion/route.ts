import { NextRequest, NextResponse } from "next/server";
import { recordEclosion } from "@/lib/queries/incubations";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_MODIFIER);
    const { id } = await params;
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // nombreLarvesEcloses — required, entier positif
    if (
      body.nombreLarvesEcloses === undefined ||
      body.nombreLarvesEcloses === null ||
      typeof body.nombreLarvesEcloses !== "number" ||
      body.nombreLarvesEcloses < 0 ||
      !Number.isInteger(body.nombreLarvesEcloses)
    ) {
      errors.push({
        field: "nombreLarvesEcloses",
        message:
          "Le nombre de larves ecloses est obligatoire et doit etre un entier positif ou nul.",
      });
    }

    // dateEclosionReelle — required, date ISO 8601
    if (
      !body.dateEclosionReelle ||
      typeof body.dateEclosionReelle !== "string" ||
      isNaN(Date.parse(body.dateEclosionReelle))
    ) {
      errors.push({
        field: "dateEclosionReelle",
        message: "La date d'eclosion reelle est obligatoire (format ISO 8601).",
      });
    }

    // nombreDeformes — optionnel, doit etre positif si fourni
    if (
      body.nombreDeformes !== undefined &&
      body.nombreDeformes !== null &&
      (typeof body.nombreDeformes !== "number" ||
        body.nombreDeformes < 0 ||
        !Number.isInteger(body.nombreDeformes))
    ) {
      errors.push({
        field: "nombreDeformes",
        message: "Le nombre de deformes doit etre un entier positif ou nul.",
      });
    }

    // Coherence : nombreDeformes <= nombreLarvesEcloses
    if (
      errors.length === 0 &&
      body.nombreDeformes !== undefined &&
      body.nombreDeformes !== null &&
      body.nombreDeformes > body.nombreLarvesEcloses
    ) {
      errors.push({
        field: "nombreDeformes",
        message:
          "Le nombre de deformes ne peut pas depasser le nombre total de larves ecloses.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const result = await recordEclosion(id, auth.activeSiteId, {
      nombreLarvesEcloses: body.nombreLarvesEcloses,
      nombreDeformes: body.nombreDeformes ?? undefined,
      dateEclosionReelle: body.dateEclosionReelle,
      notes: body.notes?.trim() ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/incubations/[id]/eclosion",
      error,
      "Erreur serveur lors de l'enregistrement de l'eclosion.",
      {
        statusMap: [
          {
            match: ["est deja terminee", "déjà terminée"],
            status: 409,
          },
        ],
      }
    );
  }
}
