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
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.ABONNEMENTS_VOIR);

    // R8 : siteId passé pour garantir l'appartenance au site actif
    const abonnement = await getAbonnementById(id, auth.activeSiteId);

    if (!abonnement) {
      return NextResponse.json(
        { status: 404, message: "Abonnement introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(abonnement);
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
      { status: 500, message: "Erreur serveur lors de la recuperation de l'abonnement." },
      { status: 500 }
    );
  }
}
