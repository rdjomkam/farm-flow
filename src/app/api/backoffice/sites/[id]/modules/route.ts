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
import { ForbiddenError } from "@/lib/permissions";
import { updateSiteModulesAdmin } from "@/lib/queries/admin-sites";
import { SiteModule } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError, handleApiError } from "@/lib/api-utils";

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
      return apiError(400, "Corps de la requete invalide (JSON attendu).");
    }

    if (typeof body !== "object" || body === null) {
      return apiError(400, "Corps de la requete invalide.");
    }

    const { enabledModules } = body as Record<string, unknown>;

    // enabledModules doit etre un tableau
    if (!Array.isArray(enabledModules)) {
      return apiError(400, "Le champ enabledModules doit etre un tableau.", { code: ErrorKeys.VALIDATION_FIELD_REQUIRED, });
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
    return handleApiError("PATCH /api/backoffice/sites/[id]/modules", error, "Erreur serveur lors de la mise a jour des modules du site.", {
      code: ErrorKeys.SERVER_GENERIC,
    });
  }
}
