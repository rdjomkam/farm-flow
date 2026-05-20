import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission, TypeReleve } from "@/types";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-utils";

export interface BacBiometryEntry {
  bacId: string;
  nom: string;
  nombrePoissons: number;
  dernierPoidsMoyenG: number | null;
  derniereBiometrieDate: string | null;
}

export interface BacsBiometryResponse {
  bacs: BacBiometryEntry[];
}

/**
 * GET /api/vagues/[id]/bacs-biometry
 *
 * Returns per-bac biometry data for a single vague.
 * Only returns currently assigned bacs (dateFin: null).
 * Each bac entry includes the latest BIOMETRIE releve data if available.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id: vagueId } = await params;

    // Verify vague belongs to active site
    const vague = await prisma.vague.findFirst({
      where: { id: vagueId, siteId: auth.activeSiteId },
      select: { id: true },
    });

    if (!vague) {
      return apiError(404, "Vague introuvable.");
    }

    // Get all currently assigned bacs (dateFin null = active assignment)
    const assignations = await prisma.assignationBac.findMany({
      where: {
        vagueId,
        siteId: auth.activeSiteId,
        dateFin: null,
      },
      include: {
        bac: {
          select: { id: true, nom: true },
        },
      },
      orderBy: { dateAssignation: "asc" },
    });

    if (assignations.length === 0) {
      return NextResponse.json({ bacs: [] });
    }

    const bacIds = assignations.map((a) => a.bacId);

    // For each bac, find the latest BIOMETRIE releve with poidsMoyen not null
    const latestBiometries = await prisma.releve.findMany({
      where: {
        vagueId,
        siteId: auth.activeSiteId,
        typeReleve: TypeReleve.BIOMETRIE,
        bacId: { in: bacIds },
        poidsMoyen: { not: null },
      },
      select: {
        bacId: true,
        poidsMoyen: true,
        date: true,
      },
      orderBy: { date: "desc" },
    });

    // Build a map bacId -> latest biometry (first occurrence per bacId since ordered desc)
    const latestBiometryByBac = new Map<
      string,
      { poidsMoyen: number; date: Date }
    >();
    for (const releve of latestBiometries) {
      if (releve.bacId && !latestBiometryByBac.has(releve.bacId)) {
        latestBiometryByBac.set(releve.bacId, {
          poidsMoyen: releve.poidsMoyen!,
          date: releve.date,
        });
      }
    }

    const bacs: BacBiometryEntry[] = assignations.map((assignation) => {
      const biometry = latestBiometryByBac.get(assignation.bacId);
      return {
        bacId: assignation.bacId,
        nom: assignation.bac.nom,
        nombrePoissons: assignation.nombreActuel ?? 0,
        dernierPoidsMoyenG: biometry ? biometry.poidsMoyen : null,
        derniereBiometrieDate: biometry
          ? biometry.date.toISOString()
          : null,
      };
    });

    return NextResponse.json({ bacs });
  } catch (error) {
    return handleApiError(
      "GET /api/vagues/[id]/bacs-biometry",
      error,
      "Erreur serveur lors de la recuperation des donnees de biometrie des bacs."
    );
  }
}
