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
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);

    // R8 : siteId = auth.activeSiteId → résout via ownerId
    const abonnement = await getAbonnementActifPourSite(auth.activeSiteId);

    // Retourner null si aucun abonnement actif (pas d'erreur 404 — comportement normal)
    return NextResponse.json({ abonnement: abonnement ?? null });
  } catch (error) {
    return handleApiError("GET /api/abonnements/actif", error, "Erreur serveur lors de la recuperation de l'abonnement actif.");
  }
}
