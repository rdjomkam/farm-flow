import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeSystemeBac } from "@/types";
import { prisma } from "@/lib/db";
import { calculerDensiteBac } from "@/lib/calculs";
import { getConfigElevageDefaut, CONFIG_ELEVAGE_DEFAULTS } from "@/lib/queries/config-elevage";
import { getStatutDensite, type StatutDensite } from "@/lib/density-thresholds";
import { apiError } from "@/lib/api-utils";

export interface BacDensiteResponse {
  bacId: string;
  bacNom: string;
  densiteKgM3: number | null;
  statut: StatutDensite;
  typeSysteme: TypeSystemeBac | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id } = await params;

    // Charger la vague avec tous ses bacs et releves
    const vague = await prisma.vague.findFirst({
      where: { id, siteId: auth.activeSiteId },
      include: {
        bacs: {
          select: {
            id: true,
            nom: true,
            volume: true,
            nombreInitial: true,
            typeSysteme: true,
          },
        },
        releves: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            typeReleve: true,
            date: true,
            poidsMoyen: true,
            nombreMorts: true,
            nombreCompte: true,
            bacId: true,
          },
        },
      },
    });

    if (!vague) {
      return apiError(404, "Vague introuvable.");
    }

    if (vague.bacs.length === 0) {
      return NextResponse.json({ densites: [] });
    }

    const relevesAdaptes = vague.releves.map((r) => ({
      bacId: r.bacId ?? null,
      typeReleve: r.typeReleve,
      nombreMorts: r.nombreMorts ?? null,
      nombreCompte: r.nombreCompte ?? null,
      poidsMoyen: r.poidsMoyen ?? null,
      date: r.date,
    }));

    const allBacsSimple = vague.bacs.map((b) => ({
      id: b.id,
      nombreInitial: b.nombreInitial,
    }));

    // Charger la config elevage du site pour les seuils differencies
    const configElevage = await getConfigElevageDefaut(auth.activeSiteId);
    const configPourSeuils = configElevage ?? CONFIG_ELEVAGE_DEFAULTS;

    const densites: BacDensiteResponse[] = vague.bacs.map((bac) => {
      const densiteKgM3 = calculerDensiteBac(
        { id: bac.id, volume: bac.volume, nombreInitial: bac.nombreInitial },
        allBacsSimple,
        relevesAdaptes,
        vague.nombreInitial
      );

      const statut = getStatutDensite(
        densiteKgM3,
        (bac.typeSysteme as TypeSystemeBac | null) ?? null,
        configPourSeuils
      );

      return {
        bacId: bac.id,
        bacNom: bac.nom,
        densiteKgM3,
        statut,
        typeSysteme: (bac.typeSysteme as TypeSystemeBac | null) ?? null,
      };
    });

    return NextResponse.json({ densites });
  } catch (error) {
    console.error("[GET /api/vagues/[id]/densites] Error:", error);
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors du calcul des densites.");
  }
}
