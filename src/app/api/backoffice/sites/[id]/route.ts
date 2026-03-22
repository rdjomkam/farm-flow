/**
 * GET /api/backoffice/sites/[id] — detail complet d'un site.
 *
 * Guard : requireSuperAdmin (ADR-022)
 * Story C.2 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { getAdminSiteById } from "@/lib/queries/admin-sites";
import { ErrorKeys } from "@/lib/api-error-keys";

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
      return NextResponse.json(
        {
          status: 404,
          message: "Site introuvable.",
          errorKey: ErrorKeys.NOT_FOUND_SITE,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(site);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message, errorKey: ErrorKeys.AUTH_UNAUTHORIZED },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message, errorKey: ErrorKeys.AUTH_FORBIDDEN },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la recuperation du site.",
        errorKey: ErrorKeys.SERVER_GENERIC,
      },
      { status: 500 }
    );
  }
}
