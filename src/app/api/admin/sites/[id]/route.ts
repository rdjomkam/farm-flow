/**
 * src/app/api/admin/sites/[id]/route.ts
 *
 * GET /api/admin/sites/[id] — detail complet d'un site (admin plateforme)
 *
 * Story B.3 — Sprint 35
 * Guard : permission SITES_VOIR + session.activeSiteId doit etre le site plateforme
 * R2 : enums importes depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { isPlatformSite } from "@/lib/queries/sites";
import { getAdminSiteById } from "@/lib/queries/admin-sites";
import { Permission } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Guard : authentification + permission SITES_VOIR
    const auth = await requirePermission(request, Permission.SITES_VOIR);

    // Guard : le site actif de la session doit etre le site plateforme
    const isPlatform = await isPlatformSite(auth.activeSiteId);
    if (!isPlatform) {
      return NextResponse.json(
        {
          status: 403,
          message: "Acces reserve au site plateforme.",
          errorKey: ErrorKeys.AUTH_FORBIDDEN,
        },
        { status: 403 }
      );
    }

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
