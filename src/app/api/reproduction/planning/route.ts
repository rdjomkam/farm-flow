/**
 * GET /api/reproduction/planning — Evenements de planning reproduction
 *
 * Retourne les evenements de planning pour une periode donnee :
 * pontes planifiees, incubations en cours, lots en elevage et eclosions prevues.
 *
 * Query params :
 *   dateDebut : string (ISO date, REQUIS) — debut de la periode
 *   dateFin   : string (ISO date, REQUIS) — fin de la periode
 *
 * Requiert la permission ALEVINS_VOIR.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getReproductionPlanningEvents } from "@/lib/queries/reproduction-stats";
import { apiError, handleApiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/reproduction/planning
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { searchParams } = new URL(request.url);

    // dateDebut — requis
    const dateDebutParam = searchParams.get("dateDebut");
    if (!dateDebutParam) {
      return apiError(400, "Le parametre 'dateDebut' est obligatoire.");
    }
    const dateDebut = new Date(dateDebutParam);
    if (isNaN(dateDebut.getTime())) {
      return apiError(
        400,
        "Le parametre 'dateDebut' doit etre une date ISO valide."
      );
    }

    // dateFin — requis
    const dateFinParam = searchParams.get("dateFin");
    if (!dateFinParam) {
      return apiError(400, "Le parametre 'dateFin' est obligatoire.");
    }
    const dateFin = new Date(dateFinParam);
    if (isNaN(dateFin.getTime())) {
      return apiError(
        400,
        "Le parametre 'dateFin' doit etre une date ISO valide."
      );
    }

    // Validation : dateFin > dateDebut
    if (dateFin <= dateDebut) {
      return apiError(
        400,
        "La date de fin doit etre strictement posterieure a la date de debut."
      );
    }

    const events = await getReproductionPlanningEvents(
      auth.activeSiteId,
      dateDebut,
      dateFin
    );

    return NextResponse.json(events);
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/planning",
      error,
      "Erreur serveur lors de la recuperation des evenements de planning."
    );
  }
}
