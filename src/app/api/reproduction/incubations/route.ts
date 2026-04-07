import { NextRequest, NextResponse } from "next/server";
import { listIncubations, createIncubation } from "@/lib/queries/incubations";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutIncubation } from "@/types";
import type { CreateIncubationDTO } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_STATUTS = Object.values(StatutIncubation);

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.INCUBATIONS_VOIR);
    const { searchParams } = new URL(request.url);

    // Pagination
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    if (isNaN(limit) || limit < 1) {
      return apiError(400, "Le parametre limit doit etre un entier positif.");
    }
    if (isNaN(offset) || offset < 0) {
      return apiError(400, "Le parametre offset doit etre un entier positif ou nul.");
    }

    // Filters
    const ponteId = searchParams.get("ponteId") ?? undefined;
    const statut = searchParams.get("statut");

    if (statut && !VALID_STATUTS.includes(statut as StatutIncubation)) {
      return apiError(
        400,
        `Statut invalide. Valeurs acceptees : ${VALID_STATUTS.join(", ")}.`
      );
    }

    const { data, total } = await listIncubations(auth.activeSiteId, {
      ponteId,
      statut: statut ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/incubations",
      error,
      "Erreur serveur lors de la recuperation des incubations."
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.INCUBATIONS_GERER);
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    // ponteId — required
    if (!body.ponteId || typeof body.ponteId !== "string") {
      errors.push({
        field: "ponteId",
        message: "L'identifiant de la ponte est obligatoire.",
      });
    }

    // substrat — required (string, mapped to enum by query layer)
    if (!body.substrat || typeof body.substrat !== "string") {
      errors.push({
        field: "substrat",
        message: "Le substrat d'incubation est obligatoire.",
      });
    }

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

    // nombreOeufsPlaces — optionnel, doit etre un entier positif si fourni
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

    // dateDebutIncubation — optionnel, doit etre une date valide si fourni
    if (
      body.dateDebutIncubation !== undefined &&
      body.dateDebutIncubation !== null &&
      (typeof body.dateDebutIncubation !== "string" ||
        isNaN(Date.parse(body.dateDebutIncubation)))
    ) {
      errors.push({
        field: "dateDebutIncubation",
        message: "La date de debut d'incubation doit etre au format ISO 8601.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const dto: CreateIncubationDTO = {
      ponteId: body.ponteId,
      substrat: body.substrat,
      temperatureEauC: body.temperatureEauC ?? undefined,
      dureeIncubationH: body.dureeIncubationH ?? undefined,
      dateDebutIncubation: body.dateDebutIncubation ?? undefined,
      dateEclosionPrevue: body.dateEclosionPrevue ?? undefined,
      nombreOeufsPlaces: body.nombreOeufsPlaces ?? undefined,
      notes: body.notes?.trim() ?? undefined,
      code: body.code?.trim() ?? undefined,
    };

    const incubation = await createIncubation(auth.activeSiteId, dto);

    return NextResponse.json(
      { id: incubation.id, code: incubation.code, statut: incubation.statut },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(
      "POST /api/reproduction/incubations",
      error,
      "Erreur serveur lors de la creation de l'incubation.",
      {
        statusMap: [
          {
            match: ["est deja utilise", "est déjà utilisé"],
            status: 409,
          },
        ],
      }
    );
  }
}
