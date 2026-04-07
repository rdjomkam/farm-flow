/**
 * GET /api/reproduction/kpis/lots — KPIs par phase des lots d'alevins
 *
 * Retourne la decomposition des lots actifs par phase avec le nombre de poissons
 * et la duree moyenne passee dans chaque phase.
 *
 * Requiert la permission ALEVINS_VOIR.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getReproductionLotsKpis } from "@/lib/queries/reproduction-stats";
import { handleApiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/reproduction/kpis/lots
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ALEVINS_VOIR);

    const data = await getReproductionLotsKpis(auth.activeSiteId);

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(
      "GET /api/reproduction/kpis/lots",
      error,
      "Erreur serveur lors du calcul des KPIs par phase des lots."
    );
  }
}
