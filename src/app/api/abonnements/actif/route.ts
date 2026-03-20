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
import { getAbonnementActif } from "@/lib/queries/abonnements";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);

    // R8 : siteId = auth.activeSiteId
    const abonnement = await getAbonnementActif(auth.activeSiteId);

    // Retourner null si aucun abonnement actif (pas d'erreur 404 — comportement normal)
    return NextResponse.json({ abonnement: abonnement ?? null });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation de l'abonnement actif." },
      { status: 500 }
    );
  }
}
