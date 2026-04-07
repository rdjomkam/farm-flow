/**
 * GET /api/reproduction/kpis/funnel — Funnel de survie de la chaine de reproduction
 *
 * Retourne les donnees du funnel de survie (oeufs → larves → alevins) pour
 * affichage graphique.
 *
 * Query params :
 *   dateDebut : string (ISO date, optionnel) — debut de la periode
 *   dateFin   : string (ISO date, optionnel) — fin de la periode
 *
 * Requiert la permission ALEVINS_VOIR.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getReproductionFunnel } from "@/lib/queries/reproduction-stats";
import { apiError, handleApiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/reproduction/kpis/funnel
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);
    const { searchParams } = new URL(request.url);

    // Parse dates optionnelles
    let dateDebut: Date | undefined;
    let dateFin: Date | undefined;

    const dateDebutParam = searchParams.get("dateDebut");
    if (dateDebutParam) {
      const d = new Date(dateDebutParam);
      if (isNaN(d.getTime())) {
        return apiError(
          400,
          "Le parametre 'dateDebut' doit etre une date ISO valide."
        );
      }
      dateDebut = d;
    }

    const dateFinParam = searchParams.get("dateFin");
    if (dateFinParam) {
      const d = new Date(dateFinParam);
      if (isNaN(d.getTime())) {
        return apiError(
          400,
          "Le parametre 'dateFin' doit etre une date ISO valide."
        );
      }
      dateFin = d;
    }

    if (dateDebut && dateFin && dateDebut > dateFin) {
      return apiError(
        400,
        "La date de debut doit etre anterieure a la date de fin."
      );
    }

    const funnel = await getReproductionFunnel(
      auth.activeSiteId,
      dateDebut,
      dateFin
    );

    return NextResponse.json({
      funnel,
      periode: {
        dateDebut: dateDebut?.toISOString() ?? null,
        dateFin: dateFin?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/kpis/funnel",
      error,
      "Erreur serveur lors du calcul du funnel de reproduction."
    );
  }
}
