import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission, TypeSystemeBac } from "@/types";
import { prisma } from "@/lib/db";
import { calculerDensiteBac } from "@/lib/calculs";
import { getConfigElevageDefaut, CONFIG_ELEVAGE_DEFAULTS } from "@/lib/queries/config-elevage";
import { getStatutDensite, type StatutDensite } from "@/lib/density-thresholds";
import { apiError, handleApiError } from "@/lib/api-utils";
import { getTransfertDestBacIds } from "@/lib/queries/transferts";

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

    // Charger la vague avec ses assignations actives et releves
    // ADR-043 Phase 3: on lit nombreInitial depuis AssignationBac (source de vérité)
    const vagueRaw = await prisma.vague.findFirst({
      where: { id, siteId: auth.activeSiteId },
      include: {
        assignations: {
          where: { dateFin: null },
          select: {
            nombreInitial: true,
            bac: {
              select: {
                id: true,
                nom: true,
                volume: true,
                typeSysteme: true,
              },
            },
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

    if (!vagueRaw) {
      return apiError(404, "Vague introuvable.");
    }

    // Construire la liste de bacs depuis les assignations actives
    const vagueBacs = vagueRaw.assignations.map((a) => ({
      id: a.bac.id,
      nom: a.bac.nom,
      volume: a.bac.volume,
      nombreInitial: a.nombreInitial,
      typeSysteme: a.bac.typeSysteme,
    }));

    if (vagueBacs.length === 0) {
      return NextResponse.json({ densites: [] });
    }

    const relevesAdaptes = vagueRaw.releves.map((r) => ({
      bacId: r.bacId ?? null,
      typeReleve: r.typeReleve,
      nombreMorts: r.nombreMorts ?? null,
      nombreCompte: r.nombreCompte ?? null,
      poidsMoyen: r.poidsMoyen ?? null,
      date: r.date,
    }));

    const allBacsSimple = vagueBacs.map((b) => ({
      id: b.id,
      nombreInitial: b.nombreInitial,
    }));

    // Charger la config elevage du site et les bacs destination de transferts en parallèle
    const [configElevage, transfertDestBacIds] = await Promise.all([
      getConfigElevageDefaut(auth.activeSiteId),
      getTransfertDestBacIds(auth.activeSiteId, id),
    ]);
    const configPourSeuils = configElevage ?? CONFIG_ELEVAGE_DEFAULTS;

    const densites: BacDensiteResponse[] = vagueBacs.map((bac) => {
      const densiteKgM3 = calculerDensiteBac(
        { id: bac.id, volume: bac.volume, nombreInitial: bac.nombreInitial },
        allBacsSimple,
        relevesAdaptes,
        vagueRaw.nombreInitial,
        { transfertDestBacIds }
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
    return handleApiError("GET /api/vagues/[id]/densites", error, "Erreur serveur lors du calcul des densites.");
  }
}
