/**
 * GET /api/backoffice/sites/[id] — detail complet d'un site.
 *
 * Guard : requireSuperAdmin (ADR-022)
 * Story C.2 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { ForbiddenError } from "@/lib/permissions";
import { getAdminSiteById } from "@/lib/queries/admin-sites";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Guard super-admin
    await requireSuperAdmin(request);

    const site = await getAdminSiteById(id);

    if (!site) {
      return apiError(404, "Site introuvable.", { code: ErrorKeys.NOT_FOUND_SITE, });
    }

    return NextResponse.json(site);
  } catch (error) {
    return handleApiError("GET /api/backoffice/sites/[id]", error, "Erreur serveur lors de la recuperation du site.", {
      code: ErrorKeys.SERVER_GENERIC,
    });
  }
}
