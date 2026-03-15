import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { getIngenieurDashboardMetrics } from "@/lib/queries/ingenieur";

/**
 * GET /api/ingenieur/dashboard
 *
 * Retourne les metriques agregees du dashboard ingenieur :
 * - Nombre de packs actifs (PackActivation.statut = ACTIVE)
 * - Taux de survie moyen sur toutes les vagues EN_COURS des sites clients
 * - Nombre d'alertes actives non lues
 * - Nombre de fermes necessitant attention (survie < 80% ou alertes actives)
 * - Nombre total de sites clients actives
 *
 * Permission requise : MONITORING_CLIENTS
 * Role : INGENIEUR (lecture seule)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.MONITORING_CLIENTS);

    const metrics = await getIngenieurDashboardMetrics(auth.activeSiteId);

    return NextResponse.json(metrics);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du chargement du dashboard ingenieur." },
      { status: 500 }
    );
  }
}
