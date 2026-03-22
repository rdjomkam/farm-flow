/**
 * src/app/api/admin/sites/route.ts
 *
 * GET /api/admin/sites — liste paginee et filtree de tous les sites (admin plateforme).
 *
 * Guards :
 *   - Permission.SITES_VOIR obligatoire
 *   - activeSiteId doit correspondre au site plateforme (isPlatform = true)
 *
 * Query params :
 *   - page        : numero de page (defaut 1)
 *   - pageSize    : taille de page (defaut 20, max 100)
 *   - status      : SiteStatus (ACTIVE | SUSPENDED | BLOCKED | ARCHIVED)
 *   - planId      : filtrer par plan d'abonnement actif
 *   - hasModule   : filtrer par module active (SiteModule)
 *   - search      : recherche par nom (insensible a la casse)
 *
 * Story B.2 — ADR-021 Admin Plateforme
 * R2 : enums importes depuis @/types
 * R8 : acces reserve au site plateforme uniquement
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { isPlatformSite } from "@/lib/queries/sites";
import { getAdminSites } from "@/lib/queries/admin-sites";
import { Permission, SiteStatus, SiteModule } from "@/types";

const VALID_SITE_STATUSES = Object.values(SiteStatus);
const VALID_SITE_MODULES = Object.values(SiteModule);

export async function GET(request: NextRequest) {
  try {
    // 1. Auth + permission SITES_VOIR
    const session = await requirePermission(request, Permission.SITES_VOIR);

    // 2. Verifier que l'utilisateur opère depuis le site plateforme
    const isPlat = await isPlatformSite(session.activeSiteId);
    if (!isPlat) {
      return NextResponse.json(
        { error: "Accès réservé au site plateforme" },
        { status: 403 }
      );
    }

    // 3. Parser les query params
    const { searchParams } = new URL(request.url);

    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const statusParam = searchParams.get("status");
    const planId = searchParams.get("planId") ?? undefined;
    const hasModuleParam = searchParams.get("hasModule");
    const search = searchParams.get("search") ?? undefined;

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : undefined;
    const pageSize = pageSizeParam
      ? Math.min(100, Math.max(1, parseInt(pageSizeParam, 10)))
      : undefined;

    const status =
      statusParam && VALID_SITE_STATUSES.includes(statusParam as SiteStatus)
        ? (statusParam as SiteStatus)
        : undefined;

    const hasModule =
      hasModuleParam && VALID_SITE_MODULES.includes(hasModuleParam as SiteModule)
        ? (hasModuleParam as SiteModule)
        : undefined;

    // 4. Appeler getAdminSites avec les filtres
    const result = await getAdminSites({
      page,
      pageSize,
      status,
      planId,
      hasModule,
      search,
    });

    return NextResponse.json(result);
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
      {
        status: 500,
        message: "Erreur serveur lors de la recuperation des sites.",
      },
      { status: 500 }
    );
  }
}
