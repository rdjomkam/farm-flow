/**
 * src/app/api/abonnements/actif/route.ts
 *
 * GET /api/abonnements/actif — abonnement actif ou en grâce du site actif
 *
 * Story 32.2 — Sprint 32
 * R2 : enums importés depuis @/types
 * R8 : siteId = auth.activeSiteId
 *
 * Utilisé par le layout pour vérifier le statut d'abonnement du site.
 * Retourne null si aucun abonnement actif (plan DECOUVERTE ou aucun abonnement).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAbonnementActifPourSite } from "@/lib/queries/abonnements";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission } from "@/types";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);

    // R8 : siteId = auth.activeSiteId → résout via ownerId
    const abonnement = await getAbonnementActifPourSite(auth.activeSiteId);

    // Retourner null si aucun abonnement actif (pas d'erreur 404 — comportement normal)
    return NextResponse.json({ abonnement: abonnement ?? null });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation de l'abonnement actif.");
  }
}
