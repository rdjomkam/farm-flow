import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { getFCRByFeed } from "@/lib/queries/fcr-by-feed";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-utils";
import type { FCRByFeedParams } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ produitId: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.STOCK_VOIR);
    const { produitId } = await params;

    // Parse optional query params
    const searchParams = request.nextUrl.searchParams;
    const minPointsRaw = searchParams.get("minPoints");
    const saisonRaw = searchParams.get("saison");

    // Load ConfigElevage for Gompertz params
    const configElevage = await prisma.configElevage.findFirst({
      where: { siteId: auth.activeSiteId, isActive: true },
      select: { gompertzMinPoints: true, gompertzWInfDefault: true },
    });

    const fcrParams: FCRByFeedParams = {
      minPoints: configElevage?.gompertzMinPoints ?? 5,
      wInfinity: configElevage?.gompertzWInfDefault ?? null,
    };
    if (minPointsRaw) {
      const n = parseInt(minPointsRaw, 10);
      if (!isNaN(n) && n > 0) fcrParams.minPoints = n;
    }
    if (saisonRaw === "SECHE" || saisonRaw === "PLUIES") {
      fcrParams.saisonFilter = saisonRaw;
    }

    const result = await getFCRByFeed(auth.activeSiteId, produitId, fcrParams);

    if (!result) {
      return apiError(404, "Produit aliment introuvable.");
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError("GET /api/analytics/aliments/[produitId]/fcr-by-feed", error, "Erreur serveur lors du calcul FCR par aliment.");
  }
}
