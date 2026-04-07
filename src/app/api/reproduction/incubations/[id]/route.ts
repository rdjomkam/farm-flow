import { NextRequest, NextResponse } from "next/server";
import { getIncubationById, updateIncubation } from "@/lib/queries/incubations";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { UpdateIncubationDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { id } = await params;

    const incubation = await getIncubationById(id, auth.activeSiteId);
    if (!incubation) {
      return apiError(404, "Incubation introuvable.");
    }

    return NextResponse.json(incubation);
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/incubations/[id]",
      error,
      "Erreur serveur lors de la recuperation de l'incubation."
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_MODIFIER);
    const { id } = await params;
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // temperatureEauC — optionnel, doit etre un nombre si fourni
    if (
      body.temperatureEauC !== undefined &&
      body.temperatureEauC !== null &&
      typeof body.temperatureEauC !== "number"
    ) {
      errors.push({
        field: "temperatureEauC",
        message: "La temperature de l'eau doit etre un nombre.",
      });
    }

    // nombreOeufsPlaces — optionnel, doit etre positif si fourni
    if (
      body.nombreOeufsPlaces !== undefined &&
      body.nombreOeufsPlaces !== null &&
      (typeof body.nombreOeufsPlaces !== "number" || body.nombreOeufsPlaces < 0)
    ) {
      errors.push({
        field: "nombreOeufsPlaces",
        message: "Le nombre d'oeufs places doit etre un entier positif ou nul.",
      });
    }

    // nombreLarvesEcloses — optionnel, doit etre positif si fourni
    if (
      body.nombreLarvesEcloses !== undefined &&
      body.nombreLarvesEcloses !== null &&
      (typeof body.nombreLarvesEcloses !== "number" || body.nombreLarvesEcloses < 0)
    ) {
      errors.push({
        field: "nombreLarvesEcloses",
        message: "Le nombre de larves ecloses doit etre un entier positif ou nul.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: UpdateIncubationDTO = {
      substrat: body.substrat ?? undefined,
      temperatureEauC: body.temperatureEauC,
      dureeIncubationH: body.dureeIncubationH,
      dateEclosionPrevue: body.dateEclosionPrevue,
      dateEclosionReelle: body.dateEclosionReelle,
      nombreOeufsPlaces: body.nombreOeufsPlaces,
      nombreLarvesEcloses: body.nombreLarvesEcloses,
      tauxEclosion: body.tauxEclosion,
      nombreDeformes: body.nombreDeformes,
      nombreLarvesViables: body.nombreLarvesViables,
      notesRetrait: body.notesRetrait ?? undefined,
      statut: body.statut ?? undefined,
      notes: body.notes !== undefined ? (body.notes?.trim() ?? null) : undefined,
    };

    const updated = await updateIncubation(id, auth.activeSiteId, dto);

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/incubations/[id]",
      error,
      "Erreur serveur lors de la mise a jour de l'incubation."
    );
  }
}
