/**
 * PATCH /api/backoffice/sites/[id]/modules — Mise a jour des modules actives d'un site.
 *
 * Guard : requireSuperAdmin (ADR-022)
 * Body  : { enabledModules: SiteModule[] }
 *
 * Story C.2 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 * R4 : mutations atomiques via updateSiteModulesAdmin (transaction Prisma)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { updateSiteModulesAdmin } from "@/lib/queries/admin-sites";
import { SiteModule } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";

const ALL_SITE_MODULE_VALUES = Object.values(SiteModule) as SiteModule[];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Guard super-admin
    const ctx = await requireSuperAdmin(request);

    // Parse et validation du corps
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: 400, message: "Corps de la requete invalide (JSON attendu)." },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { status: 400, message: "Corps de la requete invalide." },
        { status: 400 }
      );
    }

    const { enabledModules } = body as Record<string, unknown>;

    // enabledModules doit etre un tableau
    if (!Array.isArray(enabledModules)) {
      return NextResponse.json(
        {
          status: 400,
          message: "Le champ enabledModules doit etre un tableau.",
          errorKey: ErrorKeys.VALIDATION_FIELD_REQUIRED,
        },
        { status: 400 }
      );
    }

    // Valider que chaque element est une valeur SiteModule connue
    const invalidModules = (enabledModules as unknown[]).filter(
      (m) => !ALL_SITE_MODULE_VALUES.includes(m as SiteModule)
    );

    if (invalidModules.length > 0) {
      return NextResponse.json(
        {
          status: 400,
          message: `Modules inconnus : ${invalidModules.join(", ")}. Valeurs acceptees : ${ALL_SITE_MODULE_VALUES.join(", ")}.`,
          errorKey: ErrorKeys.INVALID_PLATFORM_MODULE,
        },
        { status: 400 }
      );
    }

    // Appel de la query (validation platform-module + transaction atomique)
    const result = await updateSiteModulesAdmin(
      id,
      enabledModules as SiteModule[],
      ctx.userId
    );

    return NextResponse.json(result);
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
    if (error instanceof Error) {
      return NextResponse.json(
        { status: 400, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la mise a jour des modules du site.",
        errorKey: ErrorKeys.SERVER_GENERIC,
      },
      { status: 500 }
    );
  }
}
