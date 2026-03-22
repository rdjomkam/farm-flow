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
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { updateSiteStatus } from "@/lib/queries/admin-sites";
import type { SiteLifecycleAction } from "@/lib/queries/admin-sites";
import { ErrorKeys } from "@/lib/api-error-keys";

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
      return NextResponse.json(
        {
          status: 400,
          message: "Le champ reason est obligatoire pour les actions SUSPEND et BLOCK.",
          errorKey: ErrorKeys.VALIDATION_FIELD_REQUIRED,
        },
        { status: 400 }
      );
    }

    // confirmArchive: true obligatoire pour ARCHIVE
    if (lifecycleAction === "ARCHIVE" && confirmArchive !== true) {
      return NextResponse.json(
        {
          status: 400,
          message: "Vous devez confirmer l'archivage en passant confirmArchive: true.",
          errorKey: ErrorKeys.VALIDATION_FIELD_REQUIRED,
        },
        { status: 400 }
      );
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
        message: "Erreur serveur lors de la mise a jour du statut du site.",
        errorKey: ErrorKeys.SERVER_GENERIC,
      },
      { status: 500 }
    );
  }
}
