import { NextRequest, NextResponse } from "next/server";
import { genererDepensesRecurrentes } from "@/lib/queries/depenses-recurrentes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

/**
 * POST /api/depenses-recurrentes/generer
 *
 * Déclenche la génération manuelle des dépenses récurrentes dues.
 * Idempotent : si aucune dépense n'est due, retourne generated=0.
 *
 * Permission : DEPENSES_CREER
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);

    const depenses = await genererDepensesRecurrentes(
      auth.activeSiteId,
      auth.userId
    );

    return NextResponse.json({
      generated: depenses.length,
      depenses,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return apiError(500, message);
  }
}
