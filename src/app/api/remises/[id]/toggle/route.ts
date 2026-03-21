/**
 * src/app/api/remises/[id]/toggle/route.ts
 *
 * PATCH /api/remises/[id]/toggle  — activer/désactiver une remise (auth + REMISES_GERER)
 *
 * R4 : toggle via toggleRemise (updateMany — atomique)
 *
 * Story 35.1 — Sprint 35
 * R2 : enums importés depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { getRemiseById, toggleRemise } from "@/lib/queries/remises";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { AuthError } from "@/lib/auth";
import { Permission } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, Permission.REMISES_GERER);
    const { id } = await params;

    // Récupérer l'état actuel
    const existing = await getRemiseById(id);
    if (!existing) {
      return NextResponse.json(
        { status: 404, message: "Remise introuvable." },
        { status: 404 }
      );
    }

    // Toggle atomique — R4 : updateMany pour garantir atomicité
    const newIsActif = !existing.isActif;
    await toggleRemise(id, newIsActif);

    // Retourner l'état mis à jour
    const updated = await getRemiseById(id);
    return NextResponse.json({
      remise: updated,
      isActif: newIsActif,
      message: newIsActif ? "Remise activée." : "Remise désactivée.",
    });
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
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors du toggle de la remise. ${message}` },
      { status: 500 }
    );
  }
}
