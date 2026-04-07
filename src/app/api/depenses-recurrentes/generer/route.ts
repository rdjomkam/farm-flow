import { NextRequest, NextResponse } from "next/server";
import { genererDepensesRecurrentes } from "@/lib/queries/depenses-recurrentes";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

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
    return handleApiError("POST /api/depenses-recurrentes/generer", error, "Erreur serveur.");
  }
}
