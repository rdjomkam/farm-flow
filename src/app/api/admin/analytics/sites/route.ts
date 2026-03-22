/**
 * GET /api/admin/analytics/sites — Evolution du nombre de sites dans le temps.
 *
 * Guards :
 *   - Permission.ANALYTICS_PLATEFORME obligatoire
 *   - activeSiteId doit correspondre au site plateforme (isPlatform = true)
 *
 * Query params :
 *   - period : "7d" | "30d" | "90d" | "12m" (defaut "30d")
 *
 * Cache :
 *   - Cache-Control: public, max-age=300 (5 minutes)
 *
 * Story D.2 — ADR-021 Admin Plateforme
 * R2 : enums importes depuis @/types
 * R8 : acces reserve au site plateforme uniquement
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { isPlatformSite } from "@/lib/queries/sites";
import { getSitesGrowth } from "@/lib/queries/admin-analytics";
import { Permission } from "@/types";

const VALID_PERIODS = ["7d", "30d", "90d", "12m"] as const;
type Period = (typeof VALID_PERIODS)[number];

export async function GET(request: NextRequest) {
  try {
    // 1. Auth + permission ANALYTICS_PLATEFORME
    const session = await requirePermission(request, Permission.ANALYTICS_PLATEFORME);

    // 2. Verifier que l'utilisateur opere depuis le site plateforme
    const isPlat = await isPlatformSite(session.activeSiteId);
    if (!isPlat) {
      return NextResponse.json(
        { error: "Accès réservé au site plateforme" },
        { status: 403 }
      );
    }

    // 3. Parser le query param period
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const period: Period =
      periodParam && VALID_PERIODS.includes(periodParam as Period)
        ? (periodParam as Period)
        : "30d";

    // 4. Recuperer les donnees d'evolution
    const result = await getSitesGrowth(period);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
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
    console.error("[GET /api/admin/analytics/sites]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul de l'évolution des sites." },
      { status: 500 }
    );
  }
}
