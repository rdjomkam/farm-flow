/**
 * GET /api/backoffice/sites — liste paginee et filtree de tous les sites.
 *
 * Guard : requireSuperAdmin (isSuperAdmin verifie depuis DB, ADR-022)
 *
 * Query params :
 *   - page        : numero de page (defaut 1)
 *   - pageSize    : taille de page (defaut 20, max 100)
 *   - status      : SiteStatus (ACTIVE | SUSPENDED | BLOCKED | ARCHIVED)
 *   - planId      : filtrer par plan d'abonnement actif
 *   - hasModule   : filtrer par module active (SiteModule)
 *   - search      : recherche par nom (insensible a la casse)
 *
 * Story C.2 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { getAdminSites } from "@/lib/queries/admin-sites";
import { SiteStatus, SiteModule } from "@/types";
import { apiError } from "@/lib/api-utils";

const VALID_SITE_STATUSES = Object.values(SiteStatus);
const VALID_SITE_MODULES = Object.values(SiteModule);

export async function GET(request: NextRequest) {
  try {
    // 1. Guard super-admin
    await requireSuperAdmin(request);

    // 2. Parser les query params
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

    // 3. Appeler getAdminSites avec les filtres
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
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des sites.");
  }
}
