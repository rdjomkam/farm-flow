/**
 * GET /api/admin/analytics — KPIs consolides de toute la plateforme DKFarm.
 *
 * Guards :
 *   - Permission.ANALYTICS_PLATEFORME obligatoire
 *   - activeSiteId doit correspondre au site plateforme (isPlatform = true)
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
import { getPlatformKPIs } from "@/lib/queries/admin-analytics";
import { Permission } from "@/types";

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

    // 3. Recuperer les KPIs
    const kpis = await getPlatformKPIs();

    // 4. Retourner avec header Cache-Control 5 minutes
    return NextResponse.json(kpis, {
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
    console.error("[GET /api/admin/analytics]", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du calcul des KPIs plateforme." },
      { status: 500 }
    );
  }
}
