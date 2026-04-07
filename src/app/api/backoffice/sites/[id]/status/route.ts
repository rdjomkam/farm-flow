/**
 * PATCH /api/backoffice/sites/[id]/status — Transition du cycle de vie d'un site.
 *
 * Guard : requireSuperAdmin (ADR-022)
 * Actions acceptees : SUSPEND | BLOCK | RESTORE | ARCHIVE
 * - reason requis pour SUSPEND et BLOCK
 * - confirmArchive: true requis pour ARCHIVE
 *
 * Story C.2 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 * R4 : mutations atomiques via updateSiteStatus (transaction Prisma)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { ForbiddenError } from "@/lib/permissions";
import { updateSiteStatus } from "@/lib/queries/admin-sites";
import type { SiteLifecycleAction } from "@/lib/queries/admin-sites";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_ACTIONS: SiteLifecycleAction[] = ["SUSPEND", "BLOCK", "RESTORE", "ARCHIVE"];

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

    const { action, reason, confirmArchive } = body as Record<string, unknown>;

    // Valider l'action
    if (!action || !VALID_ACTIONS.includes(action as SiteLifecycleAction)) {
      return NextResponse.json(
        {
          status: 400,
          message: `Action invalide. Valeurs acceptees : ${VALID_ACTIONS.join(", ")}.`,
          errorKey: ErrorKeys.VALIDATION_INVALID_VALUE,
        },
        { status: 400 }
      );
    }

    const lifecycleAction = action as SiteLifecycleAction;

    // reason obligatoire pour SUSPEND et BLOCK
    if (
      (lifecycleAction === "SUSPEND" || lifecycleAction === "BLOCK") &&
      (typeof reason !== "string" || reason.trim().length === 0)
    ) {
      return apiError(400, "Le champ reason est obligatoire pour les actions SUSPEND et BLOCK.", { code: ErrorKeys.VALIDATION_FIELD_REQUIRED, });
    }

    // confirmArchive: true obligatoire pour ARCHIVE
    if (lifecycleAction === "ARCHIVE" && confirmArchive !== true) {
      return apiError(400, "Vous devez confirmer l'archivage en passant confirmArchive: true.", { code: ErrorKeys.VALIDATION_FIELD_REQUIRED, });
    }

    // Appel de la query (transaction atomique)
    const result = await updateSiteStatus(
      id,
      lifecycleAction,
      ctx.userId,
      typeof reason === "string" ? reason.trim() : undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError("PATCH /api/backoffice/sites/[id]/status", error, "Erreur serveur lors de la mise a jour du statut du site.", {
      code: ErrorKeys.SERVER_GENERIC,
    });
  }
}
