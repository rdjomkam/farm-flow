/**
 * src/app/api/abonnements/[id]/route.ts
 *
 * GET /api/abonnements/[id]  — détail d'un abonnement avec paiements (auth + ABONNEMENTS_VOIR)
 *
 * Story 32.2 — Sprint 32
 * R2 : enums importés depuis @/types
 * R8 : siteId = auth.activeSiteId
 */
import { NextRequest, NextResponse } from "next/server";
import { getAbonnementById } from "@/lib/queries/abonnements";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);

    // Sprint 52 : ownership vérifié via userId (Decision 3 — siteId supprimé d'Abonnement)
    const abonnement = await getAbonnementById(id);

    if (!abonnement) {
      return apiError(404, "Abonnement introuvable.");
    }

    if (abonnement.userId !== auth.userId) {
      return apiError(403, "Accès refusé : cet abonnement n'appartient pas à votre compte.");
    }

    return NextResponse.json(abonnement);
  } catch (error) {
    return handleApiError("GET /api/abonnements/[id]", error, "Erreur serveur lors de la recuperation de l'abonnement.");
  }
}
