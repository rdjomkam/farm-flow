/**
 * src/app/api/portefeuille/retrait/[id]/route.ts
 *
 * GET /api/portefeuille/retrait/[id] — détail d'un retrait.
 *
 * - Auth + Permission.PORTEFEUILLE_VOIR
 * - L'ingénieur ne peut voir que ses propres retraits
 * - L'admin PORTEFEUILLE_GERER peut voir tous les retraits
 *
 * Story 34.2 — Sprint 34
 * R2 : enums importés depuis @/types
 * R8 : isolation par ingenieurId
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requirePermission(request, Permission.PORTEFEUILLE_VOIR);

    const retrait = await prisma.retraitPortefeuille.findUnique({
      where: { id },
      include: {
        portefeuille: {
          select: {
            id: true,
            ingenieurId: true,
            solde: true,
          },
        },
        demandeur: {
          select: { id: true, name: true },
        },
        traiteur: {
          select: { id: true, name: true },
        },
      },
    });

    if (!retrait) {
      return apiError(404, "Retrait introuvable.");
    }

    // Vérifier que l'utilisateur a accès à ce retrait
    const isAdmin = auth.permissions.includes(Permission.PORTEFEUILLE_GERER);
    if (!isAdmin && retrait.portefeuille.ingenieurId !== auth.userId) {
      return apiError(403, "Accès refusé à ce retrait.");
    }

    return NextResponse.json({ retrait });
  } catch (error) {
    return handleApiError("GET /api/portefeuille/retrait/[id]", error, "Erreur serveur lors de la recuperation du retrait.");
  }
}
