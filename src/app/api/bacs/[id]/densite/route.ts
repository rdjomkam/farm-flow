import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission, TypeReleve, TypeSystemeBac } from "@/types";
import { prisma } from "@/lib/db";
import { calculerDensiteBac, computeTauxRenouvellement } from "@/lib/calculs";
import { getConfigElevageDefaut, CONFIG_ELEVAGE_DEFAULTS } from "@/lib/queries/config-elevage";
import { getStatutDensite } from "@/lib/density-thresholds";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const { id } = await params;

    // ADR-043 Phase 3: charger le bac avec l'assignation active (source de vérité)
    const bac = await prisma.bac.findFirst({
      where: { id, siteId: auth.activeSiteId },
      include: {
        assignations: {
          where: { dateFin: null },
          take: 1,
          include: {
            vague: {
              include: {
                assignations: {
                  where: { dateFin: null },
                  include: {
                    bac: { select: { id: true } },
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
                    pourcentageRenouvellement: true,
                    volumeRenouvele: true,
                    nombreRenouvellements: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!bac) {
      return apiError(404, "Bac introuvable.");
    }

    const activeAssignation = bac.assignations?.[0] ?? null;

    // Si le bac n'est pas assigne a une vague, densite inconnue
    if (!activeAssignation?.vague) {
      return NextResponse.json({
        densiteKgM3: null,
        statut: "INCONNU",
        typeSysteme: bac.typeSysteme ?? null,
        tauxRenouvellementPctJour: null,
        joursDepuisDernierReleveQualiteEau: null,
      });
    }

    const vague = activeAssignation.vague;

    // Construire allBacs depuis les assignations actives de la vague (source de vérité)
    const allBacs = vague.assignations.map((a) => ({
      id: a.bac.id,
      nombreInitial: a.nombreInitial ?? null,
    }));

    const releves = vague.releves.map((r) => ({
      bacId: r.bacId ?? null,
      typeReleve: r.typeReleve,
      nombreMorts: r.nombreMorts ?? null,
      nombreCompte: r.nombreCompte ?? null,
      poidsMoyen: r.poidsMoyen ?? null,
      date: r.date,
    }));

    // Lire nombreInitial depuis l'assignation active (ADR-043 Phase 3)
    const densiteKgM3 = calculerDensiteBac(
      { id: bac.id, volume: bac.volume, nombreInitial: activeAssignation.nombreInitial ?? null },
      allBacs,
      releves,
      vague.nombreInitial
    );

    // Charger la config elevage du site pour les seuils differencies
    const configElevage = await getConfigElevageDefaut(auth.activeSiteId);
    const configPourSeuils = configElevage ?? CONFIG_ELEVAGE_DEFAULTS;

    const statut = getStatutDensite(
      densiteKgM3,
      (bac.typeSysteme as TypeSystemeBac | null) ?? null,
      configPourSeuils
    );

    // ---- Taux de renouvellement ----
    const fenetreJours = (configElevage as { fenetreRenouvellementJours?: number } | null)
      ?.fenetreRenouvellementJours ?? CONFIG_ELEVAGE_DEFAULTS.fenetreRenouvellementJours ?? 7;

    const relevesRenouvellement = vague.releves
      .filter((r) => r.typeReleve === TypeReleve.RENOUVELLEMENT && r.bacId === bac.id)
      .map((r) => ({
        date: r.date,
        pourcentageRenouvellement: r.pourcentageRenouvellement ?? null,
        volumeRenouvele: r.volumeRenouvele ?? null,
        nombreRenouvellements: r.nombreRenouvellements ?? null,
      }));

    const tauxRenouvellementPctJour = computeTauxRenouvellement(
      relevesRenouvellement,
      bac.volume,
      fenetreJours
    );

    // ---- Jours depuis dernier releve qualite eau ----
    const WAT_OFFSET_MS = 1 * 60 * 60 * 1000;
    const derniereQualiteEau = vague.releves
      .filter((r) => r.typeReleve === TypeReleve.QUALITE_EAU && r.bacId === bac.id)
      .at(-1) ?? null;

    let joursDepuisDernierReleveQualiteEau: number | null = null;
    if (derniereQualiteEau != null) {
      const nowWATMs = Date.now() + WAT_OFFSET_MS;
      const dateWATMs = new Date(derniereQualiteEau.date).getTime() + WAT_OFFSET_MS;
      joursDepuisDernierReleveQualiteEau = Math.floor(
        (nowWATMs - dateWATMs) / (1000 * 60 * 60 * 24)
      );
    }

    return NextResponse.json({
      densiteKgM3,
      statut,
      typeSysteme: bac.typeSysteme ?? null,
      tauxRenouvellementPctJour,
      joursDepuisDernierReleveQualiteEau,
    });
  } catch (error) {
    return handleApiError("GET /api/bacs/[id]/densite", error, "Erreur serveur lors du calcul de densite.");
  }
}
