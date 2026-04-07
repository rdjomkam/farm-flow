/**
 * GET /api/reproduction/stats — Statistiques globales de la chaine de reproduction
 *
 * Retourne les metriques agregees (taux de fecondation, eclosion, survie larvaire,
 * survie global) ainsi que les donnees du funnel de survie.
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
import { getReproductionStats, getReproductionFunnel } from "@/lib/queries/reproduction-stats";
import { apiError, handleApiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/reproduction/stats
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
        return apiError(400, "Le paramètre 'dateDebut' doit être une date ISO valide.");
      }
      dateDebut = d;
    }

    const dateFinParam = searchParams.get("dateFin");
    if (dateFinParam) {
      const d = new Date(dateFinParam);
      if (isNaN(d.getTime())) {
        return apiError(400, "Le paramètre 'dateFin' doit être une date ISO valide.");
      }
      dateFin = d;
    }

    if (dateDebut && dateFin && dateDebut > dateFin) {
      return apiError(400, "La date de début doit être antérieure à la date de fin.");
    }

    // Exécuter les deux calculs en parallèle
    const [stats, funnel] = await Promise.all([
      getReproductionStats(auth.activeSiteId, dateDebut, dateFin),
      getReproductionFunnel(auth.activeSiteId, dateDebut, dateFin),
    ]);

    return NextResponse.json({
      stats,
      funnel,
      periode: {
        dateDebut: dateDebut?.toISOString() ?? null,
        dateFin: dateFin?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/stats",
      error,
      "Erreur serveur lors du calcul des statistiques de reproduction."
    );
  }
}
