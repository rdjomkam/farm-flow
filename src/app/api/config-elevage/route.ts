import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import {
  getConfigsElevage,
  createConfigElevage,
} from "@/lib/queries/config-elevage";
import { createConfigElevageSchema } from "@/lib/validation/config-elevage";

/**
 * GET /api/config-elevage
 * Liste tous les profils ConfigElevage du site actif.
 * Permission : DASHBOARD_VOIR (tous les utilisateurs authentifies peuvent voir)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DASHBOARD_VOIR);
    const configs = await getConfigsElevage(auth.activeSiteId);
    return NextResponse.json({ configs, total: configs.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des configurations." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config-elevage
 * Cree un nouveau profil ConfigElevage.
 * Permission : SITE_GERER (ADMIN et GERANT uniquement — EC-12.2 enforced via permission check)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.SITE_GERER);

    const body = await request.json();
    const parseResult = createConfigElevageSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          status: 400,
          message: "Donnees invalides.",
          errors: parseResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const config = await createConfigElevage(auth.activeSiteId, parseResult.data);
    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du profil." },
      { status: 500 }
    );
  }
}
