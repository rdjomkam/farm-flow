/**
 * GET  /api/backoffice/feature-flags/[key] — Lire un flag.
 * PATCH /api/backoffice/feature-flags/[key] — Toggler/mettre a jour un flag.
 *
 * Guard : requireSuperAdmin() (ADR-022)
 *
 * PATCH body :
 *   { enabled: boolean; value?: Record<string, unknown> | null }
 *
 * Sur PATCH du flag MAINTENANCE_MODE :
 *   - met a jour enabled + value en DB (transaction atomique)
 *   - cree une entree PlatformAuditLog
 *   - pas de cookie : le layout root lit la DB directement (Server Component, Node.js runtime)
 *
 * ADR-maintenance-mode
 * R4 : transaction atomique (update + auditLog.create)
 * R5 : N/A (pas de composant ici)
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-utils";
import { ErrorKeys } from "@/lib/api-error-keys";
import type { FeatureFlagResponse } from "@/types";

// ---------------------------------------------------------------------------
// GET — lire un flag
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    await requireSuperAdmin(request);

    const flag = await prisma.featureFlag.findUnique({
      where: { key },
      include: {
        updatedByUser: { select: { id: true, name: true } },
      },
    });

    if (!flag) {
      return apiError(404, `Flag "${key}" introuvable.`, {
        code: ErrorKeys.NOT_FOUND_GENERIC,
      });
    }

    const response: FeatureFlagResponse = {
      key: flag.key,
      enabled: flag.enabled,
      value: (flag.value as Record<string, unknown> | null) ?? null,
      updatedAt: flag.updatedAt.toISOString(),
      updatedByName: flag.updatedByUser?.name ?? null,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message, { code: ErrorKeys.AUTH_UNAUTHORIZED });
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message, { code: ErrorKeys.AUTH_FORBIDDEN });
    }
    return apiError(500, "Erreur serveur lors de la lecture du flag.", {
      code: ErrorKeys.SERVER_GENERIC,
    });
  }
}

// ---------------------------------------------------------------------------
// PATCH — toggler/mettre a jour un flag
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const ctx = await requireSuperAdmin(request);

    // Verifier que le flag existe
    const existing = await prisma.featureFlag.findUnique({
      where: { key },
      select: { key: true, enabled: true, value: true },
    });

    if (!existing) {
      return apiError(404, `Flag "${key}" introuvable.`, {
        code: ErrorKeys.NOT_FOUND_GENERIC,
      });
    }

    // Parser le body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Corps de la requete invalide (JSON attendu).");
    }

    if (typeof body !== "object" || body === null) {
      return apiError(400, "Corps de la requete invalide.");
    }

    const { enabled, value } = body as Record<string, unknown>;

    if (typeof enabled !== "boolean") {
      return apiError(400, "Le champ 'enabled' est obligatoire et doit etre un booleen.", {
        code: ErrorKeys.VALIDATION_FIELD_REQUIRED,
      });
    }

    // Construire la valeur JSON pour le flag MAINTENANCE_MODE
    let flagValue: Record<string, unknown> | null = null;

    if (key === "MAINTENANCE_MODE" && enabled) {
      // Pour le flag maintenance, on construit le value a partir du body
      const bodyRecord = body as Record<string, unknown>;
      flagValue = {
        startedAt: new Date().toISOString(),
        ...(typeof bodyRecord.message === "string" && { message: bodyRecord.message }),
        ...(typeof bodyRecord.estimatedEnd === "string" && {
          estimatedEnd: bodyRecord.estimatedEnd,
        }),
        ...(typeof bodyRecord.internalReason === "string" && {
          internalReason: bodyRecord.internalReason,
        }),
      };
    } else if (typeof value !== "undefined" && value !== undefined) {
      flagValue = enabled
        ? (value as Record<string, unknown> | null) ?? null
        : null;
    } else if (!enabled) {
      flagValue = null;
    }

    // Transaction atomique : update flag + create audit log (R4)
    const [updatedFlag] = await prisma.$transaction([
      prisma.featureFlag.update({
        where: { key },
        data: {
          enabled,
          value: flagValue !== null
            ? (flagValue as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          updatedBy: ctx.userId,
        },
        include: {
          updatedByUser: { select: { id: true, name: true } },
        },
      }),
      prisma.platformAuditLog.create({
        data: {
          actorId: ctx.userId,
          action: enabled ? "FEATURE_FLAG_ENABLED" : "FEATURE_FLAG_DISABLED",
          details: {
            flagKey: key,
            previousValue: existing.enabled,
            newValue: enabled,
            value: flagValue ?? undefined,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);

    const response: FeatureFlagResponse = {
      key: updatedFlag.key,
      enabled: updatedFlag.enabled,
      value: (updatedFlag.value as Record<string, unknown> | null) ?? null,
      updatedAt: updatedFlag.updatedAt.toISOString(),
      updatedByName: updatedFlag.updatedByUser?.name ?? null,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message, { code: ErrorKeys.AUTH_UNAUTHORIZED });
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message, { code: ErrorKeys.AUTH_FORBIDDEN });
    }
    if (error instanceof Error) {
      return apiError(400, error.message);
    }
    return apiError(500, "Erreur serveur lors de la mise a jour du flag.", {
      code: ErrorKeys.SERVER_GENERIC,
    });
  }
}
