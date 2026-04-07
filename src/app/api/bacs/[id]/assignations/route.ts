import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getBacWithAssignations } from "@/lib/queries/bacs";
import { calculerDureeAssignation } from "@/lib/calculs";
import { apiError, handleApiError } from "@/lib/api-utils";

/**
 * GET /api/bacs/[id]/assignations
 *
 * Retourne l'historique complet des assignations d'un bac à des vagues.
 * ADR-043 — Phase 2.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const { id } = await params;

    const bac = await getBacWithAssignations(id, auth.activeSiteId);

    if (!bac) {
      return apiError(404, "Bac introuvable");
    }

    const now = new Date();
    const assignations = bac.assignations.map((a) => ({
      id: a.id,
      bacId: a.bacId,
      vagueId: a.vagueId,
      vague: (a as { vague?: { id: string; code: string; statut: string } }).vague ?? null,
      siteId: a.siteId,
      dateAssignation: a.dateAssignation,
      dateFin: a.dateFin,
      nombrePoissonsInitial: a.nombrePoissonsInitial,
      poidsMoyenInitial: a.poidsMoyenInitial,
      nombrePoissons: a.nombrePoissons,
      dureeJours: calculerDureeAssignation(a.dateAssignation, a.dateFin, now),
      active: a.dateFin === null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return NextResponse.json({
      bac: {
        id: bac.id,
        nom: bac.nom,
        volume: bac.volume,
        siteId: bac.siteId,
      },
      assignations,
      total: assignations.length,
    });
  } catch (error) {
    return handleApiError("GET /api/bacs/[id]/assignations", error, "Erreur serveur lors de la récupération des assignations.");
  }
}
