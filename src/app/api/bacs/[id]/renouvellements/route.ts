import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeReleve } from "@/types";
import { prisma } from "@/lib/db";
import { computeTauxRenouvellement } from "@/lib/calculs";
import { getConfigElevageDefaut, CONFIG_ELEVAGE_DEFAULTS } from "@/lib/queries/config-elevage";
import { apiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_VOIR);
    const { id } = await params;

    // Parametre de fenetre temporelle (defaut 30 jours)
    const searchParams = request.nextUrl.searchParams;
    const jourParam = searchParams.get("jours");
    const jours = jourParam ? Math.max(1, parseInt(jourParam, 10)) : 30;

    // Verifier que le bac appartient au site courant
    const bac = await prisma.bac.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, volume: true, siteId: true },
    });

    if (!bac) {
      return apiError(404, "Bac introuvable.");
    }

    // Fenetre de temps
    const cutoffDate = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);

    // Requeter les releves RENOUVELLEMENT pour ce bac dans la fenetre
    const releves = await prisma.releve.findMany({
      where: {
        bacId: id,
        siteId: auth.activeSiteId,
        typeReleve: TypeReleve.RENOUVELLEMENT,
        date: { gte: cutoffDate },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        pourcentageRenouvellement: true,
        volumeRenouvele: true,
        nombreRenouvellements: true,
        notes: true,
      },
    });

    // Charger la config elevage pour la fenetre de calcul
    const configElevage = await getConfigElevageDefaut(auth.activeSiteId);
    const fenetreJours =
      configElevage?.fenetreRenouvellementJours ??
      CONFIG_ELEVAGE_DEFAULTS.fenetreRenouvellementJours ??
      7;

    const relevesForCalc = releves.map((r) => ({
      date: r.date,
      pourcentageRenouvellement: r.pourcentageRenouvellement ?? null,
      volumeRenouvele: r.volumeRenouvele ?? null,
      nombreRenouvellements: r.nombreRenouvellements ?? null,
    }));

    const tauxMoyenPctJour = computeTauxRenouvellement(
      relevesForCalc,
      bac.volume,
      fenetreJours
    );

    return NextResponse.json({
      releves: releves.map((r) => ({
        id: r.id,
        date: r.date,
        pourcentageRenouvellement: r.pourcentageRenouvellement ?? null,
        volumeRenouvele: r.volumeRenouvele ?? null,
        nombreRenouvellements: r.nombreRenouvellements ?? null,
        notes: r.notes ?? null,
      })),
      tauxMoyenPctJour,
    });
  } catch (error) {
    console.error("[GET /api/bacs/[id]/renouvellements] Error:", error);
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des renouvellements.");
  }
}
