import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeReleve, TypeSystemeBac } from "@/types";
import { prisma } from "@/lib/db";
import { calculerDensiteBac, computeTauxRenouvellement } from "@/lib/calculs";
import { getConfigElevageDefaut, CONFIG_ELEVAGE_DEFAULTS } from "@/lib/queries/config-elevage";
import { getStatutDensite } from "@/lib/density-thresholds";
import { apiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const { id } = await params;

    // Charger le bac avec sa vague et les releves
    const bac = await prisma.bac.findFirst({
      where: { id, siteId: auth.activeSiteId },
      include: {
        vague: {
          include: {
            bacs: {
              select: {
                id: true,
                nombreInitial: true,
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
    });

    if (!bac) {
      return apiError(404, "Bac introuvable.");
    }

    // Si le bac n'est pas assigne a une vague, densite inconnue
    if (!bac.vague) {
      return NextResponse.json({
        densiteKgM3: null,
        statut: "INCONNU",
        typeSysteme: bac.typeSysteme ?? null,
        tauxRenouvellementPctJour: null,
        joursDepuisDernierReleveQualiteEau: null,
      });
    }

    const allBacs = bac.vague.bacs;
    const releves = bac.vague.releves.map((r) => ({
      bacId: r.bacId ?? null,
      typeReleve: r.typeReleve,
      nombreMorts: r.nombreMorts ?? null,
      nombreCompte: r.nombreCompte ?? null,
      poidsMoyen: r.poidsMoyen ?? null,
      date: r.date,
    }));

    const densiteKgM3 = calculerDensiteBac(
      { id: bac.id, volume: bac.volume, nombreInitial: bac.nombreInitial },
      allBacs,
      releves,
      bac.vague.nombreInitial
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

    const relevesRenouvellement = bac.vague.releves
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
    const derniereQualiteEau = bac.vague.releves
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
    console.error("[GET /api/bacs/[id]/densite] Error:", error);
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors du calcul de densite.");
  }
}
