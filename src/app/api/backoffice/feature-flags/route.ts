/**
 * GET /api/backoffice/feature-flags — Liste tous les feature flags.
 *
 * Guard : requireSuperAdmin() (ADR-022)
 * Retourne la liste de tous les flags avec updatedByName.
 *
 * ADR-maintenance-mode
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/backoffice";
import { AuthError } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-utils";
import { ErrorKeys } from "@/lib/api-error-keys";
import type { FeatureFlagResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const flags = await prisma.featureFlag.findMany({
      include: {
        updatedByUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: { key: "asc" },
    });

    const response: FeatureFlagResponse[] = flags.map((flag) => ({
      key: flag.key,
      enabled: flag.enabled,
      value: (flag.value as Record<string, unknown> | null) ?? null,
      updatedAt: flag.updatedAt.toISOString(),
      updatedByName: flag.updatedByUser?.name ?? null,
    }));

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message, { code: ErrorKeys.AUTH_UNAUTHORIZED });
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message, { code: ErrorKeys.AUTH_FORBIDDEN });
    }
    return apiError(500, "Erreur serveur lors de la lecture des feature flags.", {
      code: ErrorKeys.SERVER_GENERIC,
    });
  }
}
